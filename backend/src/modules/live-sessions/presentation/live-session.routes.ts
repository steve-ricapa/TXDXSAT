import { Router } from "express";
import type {
  CreateLiveSessionUseCase,
  CreateQuizUseCase,
  GetSessionResultsUseCase,
  ListQuizzesUseCase,
} from "../application/live-session.usecases.ts";

export interface LiveSessionRouterDeps {
  createQuiz: CreateQuizUseCase;
  listQuizzes: ListQuizzesUseCase;
  createSession: CreateLiveSessionUseCase;
  getResults: GetSessionResultsUseCase;
}

/**
 * REST surface of the live-session module (mounted at `/api/v1/live`).
 *
 * Handles setup only — authoring quizzes and opening a session. All gameplay
 * happens over Socket.IO. `createSession` returns the host/view credentials
 * exactly once; they are never exposed on read endpoints.
 */
export function createLiveSessionRouter(deps: LiveSessionRouterDeps): Router {
  const router = Router();

  router.post("/quizzes", async (req, res) => {
    const quiz = await deps.createQuiz.execute(req.body ?? {});
    res.status(201).json(quiz);
  });

  router.get("/quizzes", async (_req, res) => {
    const quizzes = await deps.listQuizzes.execute();
    res.json({ quizzes });
  });

  router.post("/sessions", async (req, res) => {
    const session = await deps.createSession.execute(req.body ?? {});
    res.status(201).json(session);
  });

  router.get("/sessions/:id/results", async (req, res) => {
    const token = req.header("x-session-token") ?? undefined;
    const results = await deps.getResults.execute(String(req.params.id), token);
    res.json(results);
  });

  return router;
}
