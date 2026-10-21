import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
  PlayerJoinedPayload,
  PublicQuestion,
  ResultsPayload,
  SessionStatePayload,
} from "../lib/protocol";
import { hostStore, type StoredHost } from "../lib/storage";
import { liveErrorMessage } from "../lib/error-message";
import { mergePlayerSnapshots, upsertPlayerSnapshot } from "../lib/merge-player-snapshots";
import { useAuth } from "@/modules/auth/context/AuthContext";

/** Host control screen (`/live/host/:sessionId`), protected by the host token. */
export function HostPage() {
  const { sessionId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [record, setRecord] = useState<StoredHost | null>(() => hostStore.load(sessionId));
  const tokenFromQuery = params.get("token");
  const hostToken = tokenFromQuery ?? (record?.sessionId === sessionId ? record.hostToken : null);

  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [quizTab, setQuizTab] = useState<"STANDARD" | "MIXED">("STANDARD");
  const [quizQuery, setQuizQuery] = useState("");
  const [quizPage, setQuizPage] = useState(1);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ended, setEnded] = useState<GameEndedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [startPending, setStartPending] = useState(false);
  const joinedRef = useRef(false);
  const remaining = useCountdown(question && !results ? question.endsAt : null);

  // Load the quiz catalog in setup mode.
  useEffect(() => {
    if (hostToken) return;
    setCatalogLoading(true);
    liveApi
      .listQuizzes()
      .then((data) => {
        setQuizzes(data.quizzes);
      })
      .catch((err) => setSetupError(err instanceof Error ? err.message : "No se pudieron cargar los cuestionarios"))
      .finally(() => setCatalogLoading(false));
  }, [hostToken]);

  const standardQuizzes = quizzes.filter((quiz) => quiz.origin !== "MIXED");
  const mixedQuizzes = quizzes.filter((quiz) => quiz.origin === "MIXED");
  const catalogGroup = quizTab === "STANDARD" ? standardQuizzes : mixedQuizzes;
  const filteredQuizzes = catalogGroup.filter((quiz) => `${quiz.title} ${quiz.creatorName ?? ""} ${quiz.description ?? ""}`.toLocaleLowerCase("es").includes(quizQuery.trim().toLocaleLowerCase("es")));
  const pageCount = Math.max(1, Math.ceil(filteredQuizzes.length / 6));
  const currentPage = Math.min(quizPage, pageCount);
  const visibleQuizzes = filteredQuizzes.slice((currentPage - 1) * 6, currentPage * 6);
  const selectedQuizData = quizzes.find((quiz) => quiz.id === selectedQuiz);

  // Connect as host.
  useEffect(() => {
    if (!hostToken || joinedRef.current) return;
    joinedRef.current = true;
    const socket = getSocket();
    const onError = (payload: { message?: string }) => {
      setError(liveErrorMessage(payload?.message));
      setStartPending(false);
    };
    socket.on(ServerEvents.error, onError);
    const join = () => socket.emit(ClientEvents.hostJoin, { sessionId, hostToken });
    if (socket.connected) join();
    socket.on("connect", join);

    return () => {
      joinedRef.current = false;
      socket.off(ServerEvents.error, onError);
      socket.off("connect", join);
    };
  }, [hostToken, sessionId]);

  useSocketEvent<SessionStatePayload>(ServerEvents.sessionState, (payload) => {
    if (payload.sessionId !== sessionId) return;
    setState((current) => current
      ? { ...payload, players: mergePlayerSnapshots(current.players, payload.players) }
      : payload);
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
    setCountdown(null);
    setStartPending(false);
    setState((current) => current ? { ...current, status: "ACTIVE", questionIndex: payload.index } : current);
  });

  useSocketEvent<{ countdownSeconds: number }>(ServerEvents.gameStarted, () => {
    setError(null);
    setStartPending(false);
    setQuestion(null);
    setResults(null);
    setEnded(null);
    setState((current) => current ? { ...current, status: "ACTIVE" } : current);
  });

  useSocketEvent<{ seconds: number }>(ServerEvents.gameCountdown, (payload) => setCountdown(payload.seconds));

  useSocketEvent<PlayerJoinedPayload>(ServerEvents.playerJoined, (player) => {
    setState((current) => {
      if (!current) return current;
      const players = upsertPlayerSnapshot(current.players, player);
      return { ...current, players };
    });
  });

  useSocketEvent<{ playerId: string }>(ServerEvents.playerLeft, ({ playerId }) => {
    setState((current) => current ? {
      ...current,
      players: current.players.map((player) => player.playerId === playerId ? { ...player, connected: false } : player),
    } : current);
  });

  useSocketEvent<AnswerCountPayload>(ServerEvents.gameAnswerCount, (payload) =>
    setAnsweredCount(payload.answeredCount),
  );

  useSocketEvent<ResultsPayload>(ServerEvents.gameResults, (payload) => {
    setResults(payload);
    setLeaderboard(payload.leaderboard);
  });

  useSocketEvent<LeaderboardEntry[]>(ServerEvents.gameLeaderboard, (payload) => setLeaderboard(payload));

  useSocketEvent<GameEndedPayload>(ServerEvents.gameEnded, (payload) => {
    setEnded(payload);
    setError(null);
    setCountdown(null);
    setState((current) => current ? { ...current, status: "FINISHED" } : current);
  });

  const emit = useCallback((event: string) => getSocket().emit(event, { sessionId }), [sessionId]);
  const startSession = useCallback(() => {
    if (startPending) return;
    setError(null);
    setStartPending(true);
    emit(ClientEvents.hostStart);
  }, [emit, startPending]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => value === null ? null : value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function createSession() {
    if (!selectedQuiz) return;
    setCreating(true);
    setSetupError(null);
    try {
      const created = await liveApi.createSession(selectedQuiz);
      const next: StoredHost = {
        sessionId: created.sessionId,
        pin: created.pin,
        hostToken: created.hostToken,
        viewToken: created.viewToken,
        quizTitle: created.quizTitle,
      };
      hostStore.save(next);
      setRecord(next);
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
        <div className="game-panel slide-up relative z-10 w-full max-w-3xl space-y-5 rounded-3xl p-6 sm:p-8">
          <header className="flex items-start gap-3">
            <button type="button" onClick={() => navigate(user?.role === "SUPERADMIN" ? "/superadmin" : "/admin")}
              aria-label="Volver al panel" title="Volver al panel"
              className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-ink-muted transition hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-ink">Nueva sesión en vivo</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Elige un cuestionario para generar el PIN y el QR de acceso.
              </p>
            </div>
          </header>

          {catalogLoading ? <p className="game-inset rounded-2xl p-4 text-sm text-ink-muted">Cargando cuestionarios…</p> : quizzes.length === 0 ? (
            <div className="game-inset space-y-3 rounded-2xl p-4">
              <p className="text-sm text-ink-muted">Todavía no hay cuestionarios.</p>
              <Link
                to="/live/editor"
                className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-bold text-[#04211f] hover:brightness-110"
              >
                Crear un cuestionario →
              </Link>
            </div>
          ) : <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2" aria-label="Tipo de cuestionario">
                <button type="button" aria-pressed={quizTab === "STANDARD"} onClick={() => { setQuizTab("STANDARD"); setQuizPage(1); }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${quizTab === "STANDARD" ? "bg-accent text-[#04211f]" : "game-chip text-ink-muted hover:text-ink"}`}>Originales ({standardQuizzes.length})</button>
                <button type="button" aria-pressed={quizTab === "MIXED"} onClick={() => { setQuizTab("MIXED"); setQuizPage(1); }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${quizTab === "MIXED" ? "bg-accent text-[#04211f]" : "game-chip text-ink-muted hover:text-ink"}`}>Mezclas ({mixedQuizzes.length})</button>
              </div>
              <span className="text-xs text-ink-muted">Elige una tarjeta para continuar</span>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <span className="sr-only">Buscar cuestionario por título o autor</span>
              <input value={quizQuery} onChange={(event) => { setQuizQuery(event.target.value); setQuizPage(1); }} placeholder="Buscar por título o autor…"
                className="w-full rounded-xl border border-border bg-[var(--color-field)] py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none" />
            </label>
            <div className="grid gap-2 sm:grid-cols-2" aria-label="Cuestionarios disponibles">
              {visibleQuizzes.map((quiz) => {
                const active = quiz.id === selectedQuiz;
                return <button key={quiz.id} type="button" aria-pressed={active} onClick={() => setSelectedQuiz(quiz.id)}
                  className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${active ? "border-accent bg-accent/15 ring-1 ring-accent" : quiz.origin === "MIXED" ? "border-sky-500/30 bg-sky-500/5 hover:border-sky-400" : "border-border bg-surface/60 hover:border-accent/60"}`}>
                  <span className="flex items-start justify-between gap-2"><strong className="line-clamp-2 text-sm text-ink" title={quiz.title}>{quiz.title}</strong>{active && <Check className="h-5 w-5 shrink-0 text-accent" />}</span>
                  <span className="mt-2 block text-xs text-ink-muted">{quiz.questionCount} preguntas · {quiz.origin === "MIXED" ? "Mezcla" : "Original"}</span>
                  <span className="mt-1 block truncate text-xs text-ink-muted">{quiz.creatorName ? `Por ${quiz.creatorName}` : "Autor no registrado"} · {new Date(quiz.createdAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</span>
                </button>;
              })}
              {filteredQuizzes.length === 0 && <p className="col-span-full rounded-xl border border-border p-4 text-sm text-ink-muted">{quizQuery.trim() ? "No se encontraron cuestionarios con esa búsqueda." : "No hay cuestionarios de este tipo."}</p>}
            </div>
            {pageCount > 1 && <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
              <button type="button" disabled={currentPage <= 1} onClick={() => setQuizPage(currentPage - 1)} className="inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button>
              <span>Página {currentPage} de {pageCount}</span>
              <button type="button" disabled={currentPage >= pageCount} onClick={() => setQuizPage(currentPage + 1)} className="inline-flex items-center gap-1 disabled:opacity-40">Siguiente <ChevronRight className="h-4 w-4" /></button>
            </div>}
            {selectedQuizData && <p role="status" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-ink">Seleccionado: <strong>{selectedQuizData.title}</strong> · {selectedQuizData.questionCount} preguntas</p>}
          </div>}

          {setupError && (
            <p className="rounded-xl bg-danger/15 px-4 py-3 text-sm text-danger-readable">{setupError}</p>
          )}

          <button
            type="button"
            disabled={!selectedQuiz || creating}
            onClick={createSession}
            className="w-full rounded-2xl bg-accent py-4 text-lg font-black uppercase tracking-wide text-[#04211f] shadow-[0_6px_0_0_#00a79f] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
          >
            {creating ? "Creando…" : "Crear sesión"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <Link to="/live/editor" className="text-ink-muted underline hover:text-accent">
              Editor de cuestionarios
            </Link>
            <Link to="/live/join" className="text-ink-muted underline hover:text-accent">
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
          <span className="game-chip rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-ink-muted">
            Anfitrión
          </span>
          <h1 className="truncate font-bold text-ink">{state?.quizTitle ?? record?.quizTitle ?? "Sesión"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {status === "WAITING" && (
            <span className="game-chip rounded-full px-3 py-1 text-xs font-bold text-ink">
              PIN {state?.pin ?? "—"}
            </span>
          )}
          <SoundControls />
          {presentUrl && (
            <a
              href={presentUrl}
              target="_blank"
              rel="noreferrer"
              className="game-chip rounded-full px-3 py-1.5 text-xs font-bold text-ink transition hover:border-accent/60"
            >
              🖥 Presentación
            </a>
          )}
        </div>
      </header>

      {error && (
        <p className="mx-5 rounded-xl bg-danger/15 px-4 py-2 text-sm text-danger-readable">{error}</p>
      )}

      <div className="relative z-0 grid min-h-0 flex-1 gap-4 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="flex min-h-0 flex-col gap-4">
          {!state && !error && (
            <div className="game-panel flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl p-8 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
              <p className="mt-4 text-base font-bold text-ink-muted">Cargando sesión…</p>
            </div>
          )}
          {status === "WAITING" && !ended && (
            <div className="min-h-0 flex-1">
              <Lobby
                pin={state?.pin ?? ""}
                joinUrl={joinUrl}
                quizTitle={state?.quizTitle ?? ""}
                questionCount={state?.questionCount ?? 0}
                players={state?.players ?? []}
                role="host"
                onStart={startSession}
                starting={startPending}
              />
            </div>
          )}

          {status === "ACTIVE" && question && !ended && (
            <>
              <div className="game-panel min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-3xl p-4 sm:p-5">
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
                    className="rounded-2xl bg-warning px-6 py-3 text-lg font-black uppercase tracking-wide text-[#3a2500] shadow-[0_5px_0_0_#b45309] transition hover:brightness-110 active:translate-y-1 active:shadow-none"
                  >
                    Mostrar respuesta
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => emit(ClientEvents.hostNext)}
                  disabled={!revealed}
                  className="rounded-2xl bg-accent px-6 py-3 text-lg font-black uppercase tracking-wide text-[#04211f] shadow-[0_5px_0_0_#00a79f] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
                >
                  {question.index + 1 >= question.total ? "Finalizar" : "Siguiente →"}
                </button>
                <button
                  type="button"
                  onClick={() => emit(ClientEvents.hostEnd)}
                  className="game-chip ml-auto rounded-2xl px-5 py-3 font-bold text-ink transition hover:border-accent/60"
                >
                  Terminar
                </button>
              </div>
            </>
          )}

          {status === "ACTIVE" && !question && !ended && (
            <div className="game-panel flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl p-8 text-center">
              <span className="text-7xl font-black tabular-nums text-ink">{countdown ?? "…"}</span>
              <p className="mt-3 text-lg font-bold text-ink-muted">
                {countdown === null ? "Preparando la primera pregunta…" : "La partida está por comenzar"}
              </p>
            </div>
          )}

          {status === "FINISHED" && !ended && (
            <div className="game-panel flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl p-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
              <p className="mt-4 text-base font-bold text-ink-muted">Cargando resultados finales…</p>
            </div>
          )}

          {ended && (
            <div className="game-panel relative min-h-0 flex-1 overflow-y-auto rounded-3xl p-6">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                aria-label="Volver al panel de administración"
                title="Volver al panel"
                className="absolute left-5 top-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface/80 text-ink-muted transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex min-h-full w-full flex-col items-center justify-center py-6">
                <h2 className="mb-6 text-center text-3xl font-black text-ink">🏆 Resultado final</h2>
                <Podium podium={ended.podium} leaderboard={ended.leaderboard} />
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="rounded-xl bg-accent px-8 py-3.5 font-bold text-[#04211f] shadow-lg shadow-accent/20 transition hover:scale-105 hover:brightness-110 active:scale-95"
                  >
                    Finalizar y volver al panel
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
          <section className="game-panel flex min-h-0 flex-1 flex-col rounded-2xl p-4">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-muted">Clasificación</h2>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Leaderboard entries={leaderboard} maxRows={12} />
            </div>
          </section>
          <section className="game-panel rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Jugadores</h2>
              <span className="text-2xl font-black tabular-nums text-ink">{state?.players.length ?? 0}</span>
            </div>
            {status === "WAITING" && (
              <p className="mt-2 text-xs text-ink-soft">Comparte el PIN o el QR para que se unan.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
