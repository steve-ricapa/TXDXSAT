import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getSocket } from "@/services/socket";
import { Avatar } from "../components/Avatar";
import { Leaderboard } from "../components/Leaderboard";
import { QuestionPanel, type AnswerSubmission } from "../components/QuestionPanel";
import { useCountdown } from "../hooks/useCountdown";
import { useSocketEvent } from "../hooks/useSocketEvent";
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
import { playerStore, type StoredPlayer } from "../lib/storage";

type Phase = "connecting" | "lobby" | "question" | "results" | "ended";

/** Player gameplay screen (`/live/play/:sessionId`). */
export function PlayPage() {
  const { sessionId = "" } = useParams();
  const stored = playerStore.load(sessionId);
  const socket = getSocket();

  const [record, setRecord] = useState<StoredPlayer | null>(stored);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answered, setAnswered] = useState(false);
  const [ack, setAck] = useState<AnswerAckPayload | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ended, setEnded] = useState<GameEndedPayload | null>(null);
  const [state, setState] = useState<SessionStatePayload | null>(null);
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
    if (payload.status === "WAITING") setPhase((p) => (p === "connecting" ? "lobby" : p));
  });

  useSocketEvent<PublicQuestion>(ServerEvents.gameQuestion, (payload) => {
    setQuestion(payload);
    setResults(null);
    setAck(null);
    setAnswered(false);
    setPhase("question");
  });

  useSocketEvent<AnswerAckPayload>(ServerEvents.answerAck, (payload) => {
    setAck(payload);
    setAnswered(true);
  });

  useSocketEvent<ResultsPayload>(ServerEvents.gameResults, (payload) => {
    setResults(payload);
    setLeaderboard(payload.leaderboard);
    setPhase("results");
  });

  useSocketEvent<LeaderboardEntry[]>(ServerEvents.gameLeaderboard, (payload) => setLeaderboard(payload));

  useSocketEvent<GameEndedPayload>(ServerEvents.gameEnded, (payload) => {
    setEnded(payload);
    setPhase("ended");
  });

  useSocketEvent<{ questionId: string; answeredCount: number; playerCount: number }>(
    ServerEvents.gameAnswerCount,
    () => {
      /* the player already knows they answered; counts are for the host view */
    },
  );

  const submit = useCallback(
    (answer: AnswerSubmission) => {
      if (!question) return;
      setAnswered(true); // optimistic; server ack confirms
      socket.emit(ClientEvents.playerAnswer, { questionId: question.questionId, ...answer });
    },
    [question, socket],
  );

  if (!record) return <Navigate to="/live/join" replace />;

  const myRank = ended?.leaderboard.find((entry) => entry.playerId === record.playerId);

  return (
    <div className="live-screen min-h-screen px-4 py-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar avatar={record.avatar} />
          <div>
            <p className="font-semibold text-white">{record.username}</p>
            <p className="text-xs text-white/50">{state?.quizTitle ?? "Sesión en vivo"}</p>
          </div>
        </div>
        {ack && (
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white">
            {ack.totalScore} pts
          </span>
        )}
      </header>

      {error && (
        <p className="mx-auto mt-4 max-w-2xl rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-100">{error}</p>
      )}

      <main className="mx-auto mt-8 max-w-2xl space-y-6">
        {phase === "connecting" && <p className="text-center text-white/70">Conectando…</p>}

        {phase === "lobby" && (
          <div className="rounded-3xl bg-white/10 p-8 text-center">
            <p className="text-4xl">⏳</p>
            <p className="mt-3 text-lg font-semibold text-white">¡Estás dentro!</p>
            <p className="text-sm text-white/60">Esperando a que el anfitrión inicie la partida…</p>
          </div>
        )}

        {(phase === "question" || phase === "results") && question && (
          <>
            <div className="rounded-3xl bg-white/10 p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-white/50">
                Pregunta {question.index + 1} / {question.total}
              </p>
              <h1 className="mt-1 text-xl font-bold text-white">{question.text}</h1>
              {phase === "question" && (
                <p className="mt-1 text-sm text-white/60 tabular-nums">{remaining}s</p>
              )}
            </div>
            <QuestionPanel question={question} answered={answered} onSubmit={submit} />
          </>
        )}

        {phase === "results" && results && (
          <div className="space-y-4">
            <div
              className={`rounded-2xl px-5 py-4 text-center text-lg font-bold ${
                results.type === "open_text" || results.type === "closest_to"
                  ? "bg-emerald-500/20 text-emerald-100"
                  : "bg-white/10 text-white"
              }`}
            >
              {ack?.isCorrect ? "✅ ¡Correcto!" : "❌ Incorrecto"}
              {ack && <span className="ml-2 text-sm font-medium text-white/70">+{ack.score} pts</span>}
            </div>
            <section className="rounded-2xl bg-white/10 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">Clasificación</h2>
              <Leaderboard entries={leaderboard} highlightPlayerId={record.playerId} />
            </section>
          </div>
        )}

        {phase === "ended" && (
          <div className="rounded-3xl bg-white/10 p-6 text-center">
            <p className="text-5xl">{myRank?.rank === 1 ? "🏆" : "🎉"}</p>
            <p className="mt-3 text-xl font-bold text-white">¡Has quedado #{myRank?.rank ?? "—"}!</p>
            <p className="text-sm text-white/60">
              {myRank?.score ?? 0} puntos · {myRank?.correctAnswers ?? 0}/{myRank?.totalAnswers ?? 0} correctas
            </p>
            <div className="mt-6 text-left">
              <Leaderboard entries={ended?.leaderboard ?? []} highlightPlayerId={record.playerId} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
