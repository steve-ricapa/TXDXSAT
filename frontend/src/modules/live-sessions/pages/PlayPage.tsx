import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getSocket } from "@/services/socket";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { getToken } from "@/modules/auth/lib/auth-store";
import { Avatar } from "../components/Avatar";
import { AnswerShape } from "../components/AnswerShape";
import { Confetti } from "../components/Confetti";
import { Leaderboard } from "../components/Leaderboard";
import { LiveBackground } from "../components/LiveBackground";
import { SoundControls } from "../components/SoundControls";
import { QuestionPanel, type AnswerSubmission } from "../components/QuestionPanel";
import { useCountdown } from "../hooks/useCountdown";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { paletteFor } from "../lib/answer-style";
import { ClientEvents, ServerEvents } from "../lib/protocol";
import type {
  AnswerAckPayload,
  GameEndedPayload,
  LeaderboardEntry,
  PlayerJoinedAckPayload,
  PublicQuestion,
  ResultsPayload,
  SessionStatePayload,
} from "../lib/protocol";
import { sound } from "../lib/sound";
import { playerStore, type StoredPlayer } from "../lib/storage";
import { liveErrorMessage } from "../lib/error-message";

type Phase = "connecting" | "lobby" | "question" | "results" | "ended";

/** Player gameplay screen (`/live/play/:sessionId`). Mobile-first, no scroll. */
export function PlayPage() {
  const { user } = useAuth();
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const stored = playerStore.load(sessionId);
  const owned = stored?.userId === user?.id ? stored : null;
  const socket = getSocket();

  const [record, setRecord] = useState<StoredPlayer | null>(owned);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answerPending, setAnswerPending] = useState(false);
  const [submitted, setSubmitted] = useState<{ slot?: number; text?: string } | null>(null);
  const [ack, setAck] = useState<AnswerAckPayload | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ended, setEnded] = useState<GameEndedPayload | null>(null);
  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [returnSeconds, setReturnSeconds] = useState<number | null>(null);
  const joinedRef = useRef(false);
  const recordRef = useRef<StoredPlayer | null>(record);
  recordRef.current = record;
  const endedRef = useRef(false);
  const answerPendingRef = useRef(false);
  const lastQuestionCueRef = useRef<string | null>(null);
  const remaining = useCountdown(question?.endsAt ?? null);

  // (Re)join on mount using the persisted playerId.
  useEffect(() => {
    const initialRecord = recordRef.current;
    if (!initialRecord || initialRecord.userId !== user?.id || joinedRef.current) return;
    joinedRef.current = true;

    const onJoined = (payload: PlayerJoinedAckPayload) => {
      const currentRecord = recordRef.current ?? initialRecord;
      const nextRecord: StoredPlayer = {
        ...currentRecord,
        playerId: payload.playerId,
        sessionId: payload.sessionId,
        username: payload.username,
        avatar: payload.avatar,
      };
      recordRef.current = nextRecord;
      playerStore.save(nextRecord);
      setRecord((current) => {
        if (!current) return nextRecord;
        if (
          current.playerId === nextRecord.playerId &&
          current.sessionId === nextRecord.sessionId &&
          current.username === nextRecord.username &&
          current.avatar === nextRecord.avatar
        ) return current;
        return nextRecord;
      });
      setPhase((current) => (current === "connecting" ? "lobby" : current));
    };
    const onError = (payload: { message?: string }) => {
      if (endedRef.current) return;
      if (payload?.message === "This session has already finished") return;
      setError(liveErrorMessage(payload?.message));
    };
    const onPlayerError = (payload: { event?: string; message?: string }) => {
      if (endedRef.current) return;
      if (payload?.message === "This session has already finished") return;
      if (payload.event === ClientEvents.playerAnswer) {
        answerPendingRef.current = false;
        setAnswerPending(false);
        if (payload.message === "You already answered this question") {
          setError(null);
          setAnswered(true);
        } else {
          setError(liveErrorMessage(payload?.message));
          setAnswered(false);
          setSubmitted(null);
        }
      } else {
        setError(liveErrorMessage(payload?.message));
      }
    };

    socket.on(ServerEvents.playerJoinedAck, onJoined);
    socket.on(ServerEvents.error, onError);
    socket.on(ServerEvents.playerError, onPlayerError);
    const rejoin = () => {
      const currentRecord = recordRef.current;
      if (!currentRecord || currentRecord.userId !== user?.id || endedRef.current) return;
      socket.emit(ClientEvents.playerJoin, {
        pin: currentRecord.pin,
        sessionId: currentRecord.sessionId,
        username: currentRecord.username,
        avatar: currentRecord.avatar,
        playerId: currentRecord.playerId,
        token: getToken(),
      });
    };
    if (socket.connected) rejoin();
    socket.on("connect", rejoin);

    return () => {
      joinedRef.current = false;
      socket.off(ServerEvents.playerJoinedAck, onJoined);
      socket.off(ServerEvents.error, onError);
      socket.off(ServerEvents.playerError, onPlayerError);
      socket.off("connect", rejoin);
    };
  }, [Boolean(record), sessionId, socket, user?.id]);

  useSocketEvent<SessionStatePayload>(ServerEvents.sessionState, (payload) => {
    setState(payload);
    if (payload.status === "WAITING") setPhase((current) => (current === "connecting" ? "lobby" : current));
  });

  useSocketEvent<{ seconds: number }>(ServerEvents.gameCountdown, (payload) => {
    setPhase("lobby");
    setCountdown(payload.seconds);
  });

  useSocketEvent<PublicQuestion>(ServerEvents.gameQuestion, (payload) => {
    setError(null);
    setQuestion(payload);
    setResults(null);
    setAck(null);
    answerPendingRef.current = false;
    setAnswerPending(false);
    setAnswered(false);
    setSubmitted(null);
    setCountdown(null);
    setPhase("question");
    if (lastQuestionCueRef.current !== payload.questionId) {
      lastQuestionCueRef.current = payload.questionId;
      sound.play("questionCue");
    }
  });

  useSocketEvent<AnswerAckPayload>(ServerEvents.answerAck, (payload) => {
    if (question && payload.questionId !== question.questionId) return;
    answerPendingRef.current = false;
    setAnswerPending(false);
    setAck(payload);
    setAnswered(true);
    sound.play("submit");
  });

  useSocketEvent<ResultsPayload>(ServerEvents.gameResults, (payload) => {
    setResults(payload);
    setLeaderboard(payload.leaderboard);
    setPhase("results");
    if (ack?.isCorrect) sound.play("correct");
    else sound.play("wrong");
  });

  useSocketEvent<LeaderboardEntry[]>(ServerEvents.gameLeaderboard, (payload) => setLeaderboard(payload));

  useSocketEvent<GameEndedPayload>(ServerEvents.gameEnded, (payload) => {
    endedRef.current = true;
    setError(null);
    setEnded(payload);
    setLeaderboard(payload.leaderboard as any);
    setPhase("ended");
    setReturnSeconds(10);
    sound.stopMusic();
  });

  useEffect(() => {
    if (returnSeconds === null) return;
    if (returnSeconds <= 0) {
      navigate("/employee", { replace: true });
      return;
    }
    const timer = setTimeout(() => setReturnSeconds((seconds) => seconds === null ? null : seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [navigate, returnSeconds]);

  // Local tick for the pre-question countdown.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // The short question timer needs no repeating music; keep only one-shot cues.
  useEffect(() => {
    sound.stopMusic();
    return () => sound.stopMusic();
  }, []);

  const submit = useCallback(
    (answer: AnswerSubmission) => {
      if (!question || answered || answerPendingRef.current) return;
      answerPendingRef.current = true;
      setAnswerPending(true);
      setSubmitted({
        ...(answer.chosenIndex !== undefined ? { slot: answer.chosenIndex } : {}),
        ...(answer.chosenText ? { text: answer.chosenText } : {}),
        ...(answer.chosenIndices ? { slot: answer.chosenIndices[0] } : {}),
        ...(answer.chosenIndices ? { slots: answer.chosenIndices } : {}),
      });
      socket.emit(ClientEvents.playerAnswer, { questionId: question.questionId, ...answer });
    },
    [answered, question, socket],
  );

  if (!record || record.userId !== user?.id) return <Navigate to={stored?.pin ? `/live/join?pin=${stored.pin}` : "/live/join"} replace />;

  const myRank = ended?.leaderboard.find((entry) => entry.playerId === record.playerId);
  const correct = ack?.isCorrect === true;

  return (
    <div className="live-screen flex h-[100dvh] flex-col overflow-hidden px-4 py-4">
      {(phase === "connecting" || phase === "lobby" || phase === "question") && <LiveBackground />}

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {phase === "ended" && (
            <button
              type="button"
              onClick={() => navigate("/employee")}
              aria-label="Volver al inicio de Mi capacitación"
              title="Volver a Mi capacitación"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface/80 text-ink-muted transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <Avatar avatar={record.avatar} />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{record.username}</p>
            <p className="truncate text-xs text-ink-soft">{state?.quizTitle ?? "Sesión en vivo"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ack && (
            <span className="game-chip rounded-full px-3 py-1 text-sm font-bold tabular-nums text-ink">
              {ack.totalScore} pts
            </span>
          )}
          <SoundControls compact />
        </div>
      </header>

      {error && (
        <p role="alert" className="relative z-10 mx-auto mt-3 max-w-xl shrink-0 border-l-2 border-danger bg-danger/5 px-3 py-2 text-xs leading-relaxed text-danger-readable">{error}</p>
      )}

      <main className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col">
        {phase === "connecting" && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-ink-muted">Conectando…</p>
          </div>
        )}

        {phase === "lobby" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            {countdown !== null && countdown > 0 ? (
              <>
                <span key={countdown} className="drop-in text-[8rem] font-black leading-none text-ink">
                  {countdown}
                </span>
                <p className="text-lg font-bold text-ink-muted">¡Preparados!</p>
              </>
            ) : (
              <>
                <span className="text-5xl">⏳</span>
                <p className="text-2xl font-black text-ink">¡Estás dentro!</p>
                <p className="max-w-xs text-sm text-ink-muted">
                  Mira la pantalla del anfitrión. La partida empezará en breve.
                </p>
                <div className="game-panel mt-2 rounded-2xl px-6 py-3">
                  <p className="text-xs uppercase tracking-widest text-ink-soft">PIN</p>
                  <p className="text-3xl font-black tracking-[0.3em] text-ink">{record.pin}</p>
                </div>
              </>
            )}
          </div>
        )}

        {(phase === "question" || phase === "results") && question && (
          <>
            <div className="game-panel shrink-0 rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Pregunta {question.index + 1} / {question.total}
                </p>
                {phase === "question" && (
                  <span className={`text-sm font-black tabular-nums ${remaining <= 5 ? "text-danger" : "text-ink-muted"}`}>
                    {remaining}s
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-lg font-black leading-tight text-ink sm:text-xl">{question.text}</h1>
            </div>

            {phase === "question" && <div className="mt-3 min-h-0 flex-1">
              <QuestionPanel
                question={question}
                answered={answered}
                submitting={answerPending}
                onSubmit={submit}
                submitted={submitted}
              />
            </div>}
          </>
        )}

        {phase === "results" && results && (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            <div
              className={`flex flex-col items-center gap-2 rounded-3xl px-5 py-6 text-center ${
                correct ? "bg-success text-[#04200f]" : "bg-danger text-white"
              }`}
            >
              <span className="text-5xl">{correct ? "✅" : "❌"}</span>
              <p className={`text-2xl font-black ${correct ? "text-[#04200f]" : "text-white"}`}>
                {correct ? "¡Correcto!" : "Incorrecto"}
              </p>
              {ack && (
                <p className={`text-sm font-bold ${correct ? "text-[#04200f]/80" : "text-white/85"}`}>
                  +{ack.score} pts · total {ack.totalScore}
                </p>
              )}
              {!correct && results.correctDisplayIndices.length > 0 && (
                <div className={`mt-1 flex items-center gap-2 text-sm ${correct ? "text-[#04200f]" : "text-white/90"}`}>
                  <span>Respuesta correcta:</span>
                  {results.correctDisplayIndices.map((slot) => (
                    <AnswerShape key={slot} shape={paletteFor(slot).shape} className="h-4 w-4" />
                  ))}
                </div>
              )}
              {results.explanation && (
                <p className={`mt-1 text-xs ${correct ? "text-[#04200f]/80" : "text-white/85"}`}>
                  {results.explanation}
                </p>
              )}
            </div>

            <section className="game-panel mt-4 rounded-2xl p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-muted">Clasificación</h2>
              <Leaderboard entries={leaderboard} highlightPlayerId={record.playerId} maxRows={6} />
            </section>
          </div>
        )}

        {phase === "ended" && (
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 text-center">
            <Confetti fixed pieces={80} />
            <div className="my-auto flex w-full max-w-md flex-col items-center gap-5">
              {/* Tarjeta personal de honor al estilo Kahoot */}
              <div className="flex flex-col items-center gap-3">
                <span className="drop-in text-6xl">
                  {myRank?.rank === 1 ? "🥇" : myRank?.rank === 2 ? "🥈" : myRank?.rank === 3 ? "🥉" : "🎯"}
                </span>

                <div className={myRank?.rank && myRank.rank <= 3 ? "pulse-ring rounded-full" : ""}>
                  <Avatar avatar={record.avatar} size="lg" ring />
                </div>

                <div>
                  <h2 className="text-3xl font-black text-ink">
                    {myRank?.rank === 1
                      ? "¡Eres el campeón!"
                      : myRank?.rank && myRank.rank <= 3
                      ? `¡Has quedado #${myRank.rank}!`
                      : `¡Puesto #${myRank?.rank ?? "—"}!`}
                  </h2>
                  <p className="mt-0.5 text-sm font-semibold text-ink-muted">{record.username}</p>
                </div>

                {/* Métricas destacadas con chips */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="game-chip rounded-xl px-3.5 py-1.5 text-sm font-black text-warning">
                    ⚡ {myRank?.score ?? 0} pts
                  </span>
                  <span className="game-chip rounded-xl px-3.5 py-1.5 text-sm font-bold text-ink-muted">
                    🎯 {myRank?.correctAnswers ?? 0}/{myRank?.totalAnswers ?? 0} correctas
                  </span>
                </div>
              </div>

              {/* Clasificación final contenida */}
              <div className="game-panel w-full rounded-2xl p-4 text-left shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">
                    Clasificación final
                  </h3>
                  <span className="text-xs font-semibold text-ink-soft">
                    {ended?.leaderboard.length ?? 0} {ended?.leaderboard.length === 1 ? "jugador" : "jugadores"}
                  </span>
                </div>
                <Leaderboard
                  entries={ended?.leaderboard ?? []}
                  highlightPlayerId={record.playerId}
                  maxRows={8}
                />
              </div>

              {/* Botón de volver */}
              <button
                type="button"
                onClick={() => navigate("/employee")}
                className="w-full rounded-xl bg-accent px-6 py-3.5 font-bold text-[#04211f] shadow-lg shadow-accent/20 transition hover:scale-[1.02] hover:brightness-110 active:scale-95"
              >
                Volver a Mi capacitación
              </button>
              {returnSeconds !== null && (
                <p role="status" aria-live="polite" className="text-sm text-ink-muted">
                  Volverás a Mi capacitación en {returnSeconds} {returnSeconds === 1 ? "segundo" : "segundos"}.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
