import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { routeUrl } from "@/lib/env";
import { getSocket } from "@/services/socket";
import { QrCode } from "../components/QrCode";
import { Leaderboard } from "../components/Leaderboard";
import { Podium } from "../components/Podium";
import { QuestionStage } from "../components/QuestionStage";
import { useCountdown } from "../hooks/useCountdown";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { liveApi, type QuizSummary } from "../lib/api";
import { ClientEvents, ServerEvents } from "../lib/protocol";
import type {
  GameEndedPayload,
  LeaderboardEntry,
  PublicQuestion,
  ResultsPayload,
  SessionStatePayload,
} from "../lib/protocol";
import { hostStore, type StoredHost } from "../lib/storage";

/** Host control screen (`/live/host/:sessionId`), protected by the host token. */
export function HostPage() {
  const { sessionId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState<StoredHost | null>(() => hostStore.load(sessionId));
  const tokenFromQuery = params.get("token");
  const hostToken = tokenFromQuery ?? record?.hostToken ?? null;

  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ended, setEnded] = useState<GameEndedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);
  const remaining = useCountdown(question && !results ? question.endsAt : null);

  // Load the quiz catalog in setup mode.
  useEffect(() => {
    if (hostToken) return;
    liveApi
      .listQuizzes()
      .then((data) => {
        setQuizzes(data.quizzes);
        if (data.quizzes[0]) setSelectedQuiz(data.quizzes[0].id);
      })
      .catch((err) => setSetupError(err instanceof Error ? err.message : "No se pudo cargar los quizzes"));
  }, [hostToken]);

  // Connect as host.
  useEffect(() => {
    if (!hostToken || joinedRef.current) return;
    joinedRef.current = true;
    const socket = getSocket();
    const onError = (payload: { message?: string }) => setError(payload?.message ?? "Error");
    socket.on(ServerEvents.error, onError);
    socket.emit(ClientEvents.hostJoin, { sessionId, hostToken });
    return () => {
      socket.off(ServerEvents.error, onError);
    };
  }, [hostToken, sessionId]);

  useSocketEvent<SessionStatePayload>(ServerEvents.sessionState, (payload) => {
    if (payload.sessionId !== sessionId) return;
    setState(payload);
    if (payload.viewToken) {
      const next: StoredHost = {
        sessionId,
        pin: payload.pin,
        hostToken: hostToken ?? "",
        viewToken: payload.viewToken,
        quizTitle: payload.quizTitle,
      };
      hostStore.save(next);
      setRecord(next);
    }
  });

  useSocketEvent<PublicQuestion>(ServerEvents.gameQuestion, (payload) => {
    setQuestion(payload);
    setResults(null);
    setAnsweredCount(0);
  });

  useSocketEvent<{ answeredCount: number }>(ServerEvents.gameAnswerCount, (payload) =>
    setAnsweredCount(payload.answeredCount),
  );

  useSocketEvent<ResultsPayload>(ServerEvents.gameResults, (payload) => {
    setResults(payload);
    setLeaderboard(payload.leaderboard);
  });

  useSocketEvent<LeaderboardEntry[]>(ServerEvents.gameLeaderboard, (payload) => setLeaderboard(payload));

  useSocketEvent<GameEndedPayload>(ServerEvents.gameEnded, (payload) => setEnded(payload));

  const emit = useCallback(
    (event: string) => getSocket().emit(event, { sessionId }),
    [sessionId],
  );

  async function createSession() {
    if (!selectedQuiz) return;
    setCreating(true);
    setSetupError(null);
    try {
      const created = await liveApi.createSession(selectedQuiz);
      hostStore.save({
        sessionId: created.sessionId,
        pin: created.pin,
        hostToken: created.hostToken,
        viewToken: created.viewToken,
        quizTitle: created.quizTitle,
      });
      navigate(`/live/host/${created.sessionId}`, { replace: true });
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "No se pudo crear la sesión");
    } finally {
      setCreating(false);
    }
  }

  // --- Setup mode ----------------------------------------------------------
  if (!hostToken) {
    return (
      <div className="live-screen flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-5 rounded-3xl bg-white/10 p-6 backdrop-blur">
          <header>
            <h1 className="text-2xl font-extrabold text-white">Nueva sesión en vivo</h1>
            <p className="mt-1 text-sm text-white/60">Elige un cuestionario para generar el PIN y el QR.</p>
          </header>
          {quizzes.length === 0 ? (
            <p className="text-sm text-white/70">No hay cuestionarios todavía.</p>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-white/80">Cuestionario</span>
              <select
                value={selectedQuiz}
                onChange={(event) => setSelectedQuiz(event.target.value)}
                className="mt-1 w-full rounded-xl bg-white/90 px-4 py-3 font-medium text-slate-900"
              >
                {quizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title} ({quiz.questionCount} preguntas)
                  </option>
                ))}
              </select>
            </label>
          )}
          {setupError && <p className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-100">{setupError}</p>}
          <button
            type="button"
            disabled={!selectedQuiz || creating}
            onClick={createSession}
            className="w-full rounded-xl bg-[var(--color-brand-500)] py-3.5 text-lg font-bold text-white disabled:opacity-40"
          >
            {creating ? "Creando…" : "Crear sesión"}
          </button>
        </div>
      </div>
    );
  }

  // --- Control mode --------------------------------------------------------
  const joinUrl = state ? new URL(routeUrl(`live/join?pin=${state.pin}`), window.location.origin).toString() : "";
  const presentUrl = state ? routeUrl(`live/present/${sessionId}?token=${record?.viewToken ?? ""}`) : "";
  const revealed = results !== null && question !== null && results.questionId === question.questionId;
  const status = state?.status ?? "WAITING";

  return (
    <div className="live-screen min-h-screen px-4 py-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
        <main className="space-y-6">
          {error && <p className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-100">{error}</p>}

          {status === "WAITING" && (
            <div className="rounded-3xl bg-white/10 p-6 text-center">
              <p className="text-sm uppercase tracking-wide text-white/50">PIN para unirse</p>
              <p className="text-6xl font-black tracking-[0.3em] text-white">{state?.pin ?? "—"}</p>
              {joinUrl && (
                <div className="mt-5 flex flex-col items-center gap-3">
                  <QrCode value={joinUrl} />
                  <code className="rounded-lg bg-black/30 px-3 py-1 text-xs text-white/80">{joinUrl}</code>
                </div>
              )}
              <p className="mt-4 text-sm text-white/60">
                {state?.players.length ?? 0} jugador(es) conectado(s)
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => emit(ClientEvents.hostStart)}
                  disabled={(state?.players.length ?? 0) === 0}
                  className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-white disabled:opacity-40"
                >
                  ▶ Empezar
                </button>
                {presentUrl && (
                  <a
                    href={presentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-white/15 px-6 py-3 font-semibold text-white"
                  >
                    🖥 Abrir presentación
                  </a>
                )}
              </div>
            </div>
          )}

          {status === "ACTIVE" && question && (
            <div className="rounded-3xl bg-white/10 p-6">
              <QuestionStage
                question={question}
                remaining={remaining}
                answeredCount={answeredCount}
                playerCount={state?.players.length ?? 0}
                results={revealed ? results : null}
              />
              <div className="mt-6 flex flex-wrap gap-3">
                {!revealed && (
                  <button
                    type="button"
                    onClick={() => emit(ClientEvents.hostReveal)}
                    className="rounded-xl bg-amber-500 px-5 py-2.5 font-semibold text-white"
                  >
                    Mostrar respuesta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => emit(ClientEvents.hostNext)}
                  disabled={!revealed}
                  className="rounded-xl bg-[var(--color-brand-500)] px-5 py-2.5 font-semibold text-white disabled:opacity-40"
                >
                  {question.index + 1 >= question.total ? "Finalizar" : "Siguiente →"}
                </button>
                <button
                  type="button"
                  onClick={() => emit(ClientEvents.hostEnd)}
                  className="rounded-xl bg-white/15 px-5 py-2.5 font-semibold text-white"
                >
                  Terminar
                </button>
              </div>
            </div>
          )}

          {ended && (
            <div className="rounded-3xl bg-white/10 p-6">
              <h2 className="mb-4 text-center text-xl font-bold text-white">🏁 Resultado final</h2>
              <Podium podium={ended.podium} leaderboard={ended.leaderboard} />
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl bg-white/10 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Clasificación</h2>
            <Leaderboard entries={leaderboard} compact />
          </section>
          <section className="rounded-2xl bg-white/10 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Jugadores</h2>
            <p className="text-sm text-white/80">{state?.players.length ?? 0} conectado(s)</p>
            {presentUrl && (
              <a href={presentUrl} target="_blank" rel="noreferrer" className="mt-3 block text-sm text-[var(--color-brand-300)] underline">
                Abrir vista de presentación
              </a>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
