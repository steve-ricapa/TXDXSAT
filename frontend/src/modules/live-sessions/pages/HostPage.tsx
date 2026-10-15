import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { routeUrl } from "@/lib/env";
import { getSocket } from "@/services/socket";
import { Leaderboard } from "../components/Leaderboard";
import { Lobby } from "../components/Lobby";
import { LiveBackground } from "../components/LiveBackground";
import { Podium } from "../components/Podium";
import { QuestionStage } from "../components/QuestionStage";
import { SoundControls } from "../components/SoundControls";
import { useCountdown } from "../hooks/useCountdown";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { liveApi, type QuizSummary } from "../lib/api";
import { ClientEvents, ServerEvents } from "../lib/protocol";
import type {
  AnswerCountPayload,
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
      .catch((err) => setSetupError(err instanceof Error ? err.message : "No se pudo cargar los cuestionarios"));
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

  useSocketEvent<AnswerCountPayload>(ServerEvents.gameAnswerCount, (payload) =>
    setAnsweredCount(payload.answeredCount),
  );

  useSocketEvent<ResultsPayload>(ServerEvents.gameResults, (payload) => {
    setResults(payload);
    setLeaderboard(payload.leaderboard);
  });

  useSocketEvent<LeaderboardEntry[]>(ServerEvents.gameLeaderboard, (payload) => setLeaderboard(payload));

  useSocketEvent<GameEndedPayload>(ServerEvents.gameEnded, (payload) => setEnded(payload));

  const emit = useCallback((event: string) => getSocket().emit(event, { sessionId }), [sessionId]);

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
        <LiveBackground />
        <div className="slide-up relative z-10 w-full max-w-lg space-y-5 rounded-3xl bg-black/25 p-6 backdrop-blur sm:p-8">
          <header>
            <h1 className="text-3xl font-black text-white">Nueva sesión en vivo</h1>
            <p className="mt-1 text-sm text-white/60">
              Elige un cuestionario para generar el PIN y el QR de acceso.
            </p>
          </header>

          {quizzes.length === 0 ? (
            <div className="space-y-3 rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-white/80">Todavía no hay cuestionarios.</p>
              <Link
                to="/live/editor"
                className="inline-block rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/30"
              >
                Crear un cuestionario →
              </Link>
            </div>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-white/80">Cuestionario</span>
              <select
                value={selectedQuiz}
                onChange={(event) => setSelectedQuiz(event.target.value)}
                className="mt-1 w-full rounded-xl bg-white/95 px-4 py-3 font-semibold text-slate-900"
              >
                {quizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title} ({quiz.questionCount} preguntas)
                  </option>
                ))}
              </select>
            </label>
          )}

          {setupError && (
            <p className="rounded-xl bg-red-500/25 px-4 py-3 text-sm text-red-100">{setupError}</p>
          )}

          <button
            type="button"
            disabled={!selectedQuiz || creating}
            onClick={createSession}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-black uppercase tracking-wide text-white shadow-[0_6px_0_0_#166534] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
          >
            {creating ? "Creando…" : "Crear sesión"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <Link to="/live/editor" className="text-white/70 underline hover:text-white">
              Editor de cuestionarios
            </Link>
            <Link to="/live/join" className="text-white/70 underline hover:text-white">
              Vista de jugador
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Control mode --------------------------------------------------------
  const joinUrl = state
    ? new URL(routeUrl(`live/join?pin=${state.pin}`), window.location.origin).toString()
    : "";
  const presentUrl = state ? routeUrl(`live/present/${sessionId}?token=${record?.viewToken ?? ""}`) : "";
  const revealed = results !== null && question !== null && results.questionId === question.questionId;
  const status = state?.status ?? "WAITING";

  return (
    <div className="live-screen flex h-screen flex-col overflow-hidden">
      <LiveBackground />

      {/* Top bar */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80">
            Anfitrión
          </span>
          <h1 className="truncate font-bold text-white">{state?.quizTitle ?? record?.quizTitle ?? "Sesión"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {status === "WAITING" && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
              PIN {state?.pin ?? "—"}
            </span>
          )}
          <SoundControls />
          {presentUrl && (
            <a
              href={presentUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25"
            >
              🖥 Presentación
            </a>
          )}
        </div>
      </header>

      {error && (
        <p className="mx-5 rounded-xl bg-red-500/25 px-4 py-2 text-sm text-red-100">{error}</p>
      )}

      <div className="relative z-0 grid min-h-0 flex-1 gap-4 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="flex min-h-0 flex-col gap-4">
          {status === "WAITING" && !ended && (
            <div className="min-h-0 flex-1">
              <Lobby
                pin={state?.pin ?? ""}
                joinUrl={joinUrl}
                quizTitle={state?.quizTitle ?? ""}
                questionCount={state?.questionCount ?? 0}
                players={state?.players ?? []}
                role="host"
                onStart={() => emit(ClientEvents.hostStart)}
              />
            </div>
          )}

          {status === "ACTIVE" && question && !ended && (
            <>
              <div className="min-h-0 flex-1 rounded-3xl bg-black/20 p-5 backdrop-blur">
                <QuestionStage
                  question={question}
                  remaining={remaining}
                  answeredCount={answeredCount}
                  playerCount={state?.players.length ?? 0}
                  results={revealed ? results : null}
                />
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {!revealed ? (
                  <button
                    type="button"
                    onClick={() => emit(ClientEvents.hostReveal)}
                    className="rounded-2xl bg-amber-500 px-6 py-3 text-lg font-black uppercase tracking-wide text-white shadow-[0_5px_0_0_#a16207] transition hover:brightness-110 active:translate-y-1 active:shadow-none"
                  >
                    Mostrar respuesta
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => emit(ClientEvents.hostNext)}
                  disabled={!revealed}
                  className="rounded-2xl bg-violet-500 px-6 py-3 text-lg font-black uppercase tracking-wide text-white shadow-[0_5px_0_0_#5b21b6] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
                >
                  {question.index + 1 >= question.total ? "Finalizar" : "Siguiente →"}
                </button>
                <button
                  type="button"
                  onClick={() => emit(ClientEvents.hostEnd)}
                  className="ml-auto rounded-2xl bg-white/15 px-5 py-3 font-bold text-white hover:bg-white/25"
                >
                  Terminar
                </button>
              </div>
            </>
          )}

          {ended && (
            <div className="relative min-h-0 flex-1 overflow-y-auto rounded-3xl bg-black/20 p-6 backdrop-blur">
              <h2 className="mb-6 text-center text-2xl font-black text-white">🏆 Resultado final</h2>
              <Podium podium={ended.podium} leaderboard={ended.leaderboard} />
            </div>
          )}
        </main>

        <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
          <section className="flex min-h-0 flex-1 flex-col rounded-2xl bg-black/25 p-4 backdrop-blur">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">Clasificación</h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Leaderboard entries={leaderboard} maxRows={12} />
            </div>
          </section>
          <section className="rounded-2xl bg-black/25 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">Jugadores</h2>
              <span className="text-2xl font-black tabular-nums text-white">{state?.players.length ?? 0}</span>
            </div>
            {status === "WAITING" && (
              <p className="mt-2 text-xs text-white/50">Comparte el PIN o el QR para que se unan.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
