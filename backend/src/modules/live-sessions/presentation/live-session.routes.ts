import { Router } from "express";
import type { AuthenticatedRequest } from "../../auth/presentation/auth.middleware.ts";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../shared/errors/app-error.ts";
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

  router.get("/me/results/:sessionId", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) throw new UnauthorizedError();
    const sessionId = String(req.params.sessionId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      throw new NotFoundError("Sesión no encontrada");
    }
    const result = await deps.store.getResultDetailForUser(user.id, user.tenantId, sessionId);
    if (!result) throw new NotFoundError("Resultado no disponible");
    res.json({ result });
  });

  router.post("/quizzes", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (user?.role !== "SUPERADMIN" && user?.role !== "ADMIN") {
      throw new ForbiddenError("Solo administradores pueden crear cuestionarios");
    }
    const body = req.body ?? {};
    const quiz = await deps.createQuiz.execute({
      ...body,
      tenantId: user.role === "SUPERADMIN" ? (body.tenantId ?? null) : user.tenantId,
    });
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
    const user = (req as AuthenticatedRequest).user;
    if (user?.role !== "SUPERADMIN" && user?.role !== "ADMIN") {
      throw new ForbiddenError("Solo los administradores pueden consultar el cuestionario");
    }
    const quiz = await deps.getQuizDetail.execute(String(req.params.id));
    if (user.role !== "SUPERADMIN" && quiz.tenantId !== user?.tenantId) {
      throw new ForbiddenError("No tienes permisos para consultar este cuestionario");
    }
    res.json(quiz);
  });

  router.put("/quizzes/:id", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (user?.role !== "SUPERADMIN" && user?.role !== "ADMIN") {
      throw new ForbiddenError("Solo administradores pueden editar cuestionarios");
    }
    const existing = await deps.getQuizDetail.execute(String(req.params.id));
    if (user.role !== "SUPERADMIN" && existing.tenantId !== user.tenantId) {
      throw new ForbiddenError("No tienes permisos para editar este cuestionario");
    }
    const body = req.body ?? {};
    const quiz = await deps.updateQuiz.execute(String(req.params.id), {
      ...body,
      tenantId: user.role === "SUPERADMIN" ? (body.tenantId ?? existing.tenantId) : user.tenantId,
    });
    res.json(quiz);
  });

  router.post("/sessions", async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (user?.role !== "SUPERADMIN" && user?.role !== "ADMIN") {
      throw new ForbiddenError("Solo administradores pueden crear sesiones");
    }
    const body = req.body ?? {};
    const quiz = await deps.getQuizDetail.execute(String(body.quizId));
    if (user.role !== "SUPERADMIN" && quiz.tenantId && quiz.tenantId !== user.tenantId) {
      throw new ForbiddenError("No tienes permisos para iniciar sesión con este cuestionario");
    }
    const session = await deps.createSession.execute({
      ...body,
      tenantId: user.role === "SUPERADMIN" ? (body.tenantId ?? quiz.tenantId) : user.tenantId,
    });
    res.status(201).json(session);
  });

  router.get("/sessions/:id/results", async (req, res) => {
    const token = req.header("x-session-token") ?? undefined;
    const results = await deps.getResults.execute(String(req.params.id), token);
    res.json(results);
  });

  return router;
}
