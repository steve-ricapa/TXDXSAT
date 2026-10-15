import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getSocket } from "@/services/socket";
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

type Phase = "connecting" | "lobby" | "question" | "results" | "ended";

/** Player gameplay screen (`/live/play/:sessionId`). Mobile-first, no scroll. */
export function PlayPage() {
  const { sessionId = "" } = useParams();
  const stored = playerStore.load(sessionId);
  const socket = getSocket();

  const [record, setRecord] = useState<StoredPlayer | null>(stored);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answered, setAnswered] = useState(false);
  const [submitted, setSubmitted] = useState<{ slot?: number; text?: string } | null>(null);
  const [ack, setAck] = useState<AnswerAckPayload | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ended, setEnded] = useState<GameEndedPayload | null>(null);
  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const joinedRef = useRef(false);
  const remaining = useCountdown(question?.endsAt ?? null);

  // (Re)join on mount using the persisted playerId.
  useEffect(() => {
    if (!record || joinedRef.current) return;
    joinedRef.current = true;

    const onJoined = (payload: PlayerJoinedAckPayload) => {
      playerStore.save({
        playerId: payload.playerId,
        sessionId: payload.sessionId,
        pin: record.pin,
        username: payload.username,
        avatar: payload.avatar,
      });
      setRecord((current) =>
        current
          ? { ...current, playerId: payload.playerId, username: payload.username, avatar: payload.avatar }
          : current,
      );
      setPhase((current) => (current === "connecting" ? "lobby" : current));
    };
    const onError = (payload: { message?: string }) => setError(payload?.message ?? "Error");

    socket.on(ServerEvents.playerJoinedAck, onJoined);
    socket.on(ServerEvents.error, onError);
    socket.on(ServerEvents.playerError, onError);
    socket.emit(ClientEvents.playerJoin, {
      pin: record.pin,
      username: record.username,
      avatar: record.avatar,
      playerId: record.playerId,
    });

    return () => {
      socket.off(ServerEvents.playerJoinedAck, onJoined);
      socket.off(ServerEvents.error, onError);
      socket.off(ServerEvents.playerError, onError);
    };
  }, [record, socket]);

  useSocketEvent<SessionStatePayload>(ServerEvents.sessionState, (payload) => {
    setState(payload);
    if (payload.status === "WAITING") setPhase((current) => (current === "connecting" ? "lobby" : current));
  });

  useSocketEvent<{ seconds: number }>(ServerEvents.gameCountdown, (payload) => {
    setPhase("lobby");
    setCountdown(payload.seconds);
    sound.play("heartbeat");
  });

  useSocketEvent<PublicQuestion>(ServerEvents.gameQuestion, (payload) => {
    setQuestion(payload);
    setResults(null);
    setAck(null);
    setAnswered(false);
    setSubmitted(null);
    setCountdown(null);
    setPhase("question");
    sound.play("blip");
  });

  useSocketEvent<AnswerAckPayload>(ServerEvents.answerAck, (payload) => {
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
    setEnded(payload);
    setLeaderboard(payload.leaderboard as any);
    setPhase("ended");
    sound.stopMusic();
  });

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

  useEffect(() => {
    if (countdown !== null && countdown > 0) sound.startMusic("lobby");
  }, [countdown]);

  const submit = useCallback(
    (answer: AnswerSubmission) => {
      if (!question) return;
      setAnswered(true); // optimistic; server ack confirms
      setSubmitted({
        ...(answer.chosenIndex !== undefined ? { slot: answer.chosenIndex } : {}),
        ...(answer.chosenText ? { text: answer.chosenText } : {}),
        ...(answer.chosenIndices ? { slot: answer.chosenIndices[0] } : {}),
      });
      socket.emit(ClientEvents.playerAnswer, { questionId: question.questionId, ...answer });
    },
    [question, socket],
  );

  if (!record) return <Navigate to="/live/join" replace />;

  const myRank = ended?.leaderboard.find((entry) => entry.playerId === record.playerId);
  const correct = ack?.isCorrect === true;

  return (
    <div className="live-screen flex h-[100dvh] flex-col overflow-hidden px-4 py-4">
      <LiveBackground />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar avatar={record.avatar} />
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{record.username}</p>
            <p className="truncate text-xs text-white/50">{state?.quizTitle ?? "Sesión en vivo"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ack && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold tabular-nums text-white">
              {ack.totalScore} pts
            </span>
          )}
          <SoundControls compact />
        </div>
      </header>

      {error && (
        <p className="relative z-10 mt-3 shrink-0 rounded-xl bg-red-500/25 px-4 py-2 text-sm text-red-100">{error}</p>
      )}

      <main className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col">
        {phase === "connecting" && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-white/70">Conectando…</p>
          </div>
        )}

        {phase === "lobby" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            {countdown !== null && countdown > 0 ? (
              <>
                <span key={countdown} className="drop-in text-[8rem] font-black leading-none text-white">
                  {countdown}
                </span>
                <p className="text-lg font-bold text-white/80">¡Preparados!</p>
              </>
            ) : (
              <>
                <span className="text-5xl">⏳</span>
                <p className="text-2xl font-black text-white">¡Estás dentro!</p>
                <p className="max-w-xs text-sm text-white/60">
                  Mira la pantalla del anfitrión. La partida empezará en breve.
                </p>
                <div className="mt-2 rounded-2xl bg-black/25 px-6 py-3 backdrop-blur">
                  <p className="text-xs uppercase tracking-widest text-white/50">PIN</p>
                  <p className="text-3xl font-black tracking-[0.3em] text-white">{record.pin}</p>
                </div>
              </>
            )}
          </div>
        )}

        {(phase === "question" || phase === "results") && question && (
          <>
            <div className="shrink-0 rounded-2xl bg-black/25 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Pregunta {question.index + 1} / {question.total}
                </p>
                {phase === "question" && (
                  <span className={`text-sm font-black tabular-nums ${remaining <= 5 ? "text-red-300" : "text-white/70"}`}>
                    {remaining}s
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-lg font-black leading-tight text-white sm:text-xl">{question.text}</h1>
            </div>

            <div className="mt-3 min-h-0 flex-1">
              <QuestionPanel question={question} answered={answered} onSubmit={submit} submitted={submitted} />
            </div>
          </>
        )}

        {phase === "results" && results && (
          <div className="pop-in mt-3 min-h-0 flex-1 overflow-y-auto">
            <div
              className={`flex flex-col items-center gap-2 rounded-3xl px-5 py-6 text-center ${
                correct ? "bg-emerald-500" : "bg-rose-600"
              }`}
            >
              <span className="text-5xl">{correct ? "✅" : "❌"}</span>
              <p className="text-2xl font-black text-white">{correct ? "¡Correcto!" : "Incorrecto"}</p>
              {ack && (
                <p className="text-sm font-bold text-white/80">
                  +{ack.score} pts · total {ack.totalScore}
                </p>
              )}
              {!correct && results.correctDisplayIndices.length > 0 && (
                <div className="mt-1 flex items-center gap-2 text-sm text-white/90">
                  <span>Respuesta correcta:</span>
                  {results.correctDisplayIndices.map((slot) => (
                    <AnswerShape key={slot} shape={paletteFor(slot).shape} className="h-4 w-4" />
                  ))}
                </div>
              )}
              {results.explanation && <p className="mt-1 text-xs text-white/80">{results.explanation}</p>}
            </div>

            <section className="mt-4 rounded-2xl bg-black/25 p-4 backdrop-blur">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">Clasificación</h2>
              <Leaderboard entries={leaderboard} highlightPlayerId={record.playerId} maxRows={6} />
            </section>
          </div>
        )}

        {phase === "ended" && (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto text-center">
            <Confetti pieces={60} />
            <span className="text-6xl">{myRank?.rank === 1 ? "🏆" : "🎉"}</span>
            <p className="text-3xl font-black text-white">¡Has quedado #{myRank?.rank ?? "—"}!</p>
            <p className="text-lg font-bold text-white/80">
              {myRank?.score ?? 0} puntos · {myRank?.correctAnswers ?? 0}/{myRank?.totalAnswers ?? 0} correctas
            </p>
            <div className="mt-2 w-full rounded-2xl bg-black/25 p-4 text-left backdrop-blur">
              <Leaderboard entries={ended?.leaderboard ?? []} highlightPlayerId={record.playerId} maxRows={10} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
