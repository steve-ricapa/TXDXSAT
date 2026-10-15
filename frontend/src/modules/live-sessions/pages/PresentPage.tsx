import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { routeUrl } from "@/lib/env";
import { getSocket } from "@/services/socket";
import { Avatar } from "../components/Avatar";
import { Podium } from "../components/Podium";
import { QrCode } from "../components/QrCode";
import { QuestionStage } from "../components/QuestionStage";
import { useCountdown } from "../hooks/useCountdown";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { ClientEvents, ServerEvents } from "../lib/protocol";
import type {
  GameEndedPayload,
  PublicQuestion,
  ResultsPayload,
  SessionStatePayload,
} from "../lib/protocol";
import { sound } from "../lib/sound";
import { hostStore } from "../lib/storage";

/**
 * Presenter / projector screen (`/live/present/:sessionId`).
 *
 * Authorized by the read-only view token (never the host token), so it can be
 * opened on a shared machine without granting game control.
 */
export function PresentPage() {
  const { sessionId = "" } = useParams();
  const [params] = useSearchParams();
  const viewToken = params.get("token") ?? hostStore.load(sessionId)?.viewToken ?? null;

  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [ended, setEnded] = useState<GameEndedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(sound.isMuted());
  const joinedRef = useRef(false);
  const remaining = useCountdown(question && !results ? question.endsAt : null);

  useEffect(() => {
    if (!viewToken || joinedRef.current) return;
    joinedRef.current = true;
    const socket = getSocket();
    const onError = (payload: { message?: string }) => setError(payload?.message ?? "Error");
    socket.on(ServerEvents.error, onError);
    socket.emit(ClientEvents.presentJoin, { sessionId, viewToken });
    return () => {
      socket.off(ServerEvents.error, onError);
    };
  }, [viewToken, sessionId]);

  useSocketEvent<SessionStatePayload>(ServerEvents.sessionState, (payload) => {
    if (payload.sessionId === sessionId) setState(payload);
  });
  useSocketEvent<PublicQuestion>(ServerEvents.gameQuestion, (payload) => {
    setQuestion(payload);
    setResults(null);
    sound.play("blip");
  });
  useSocketEvent<ResultsPayload>(ServerEvents.gameResults, (payload) => {
    setResults(payload);
    sound.play("correct");
  });
  useSocketEvent<GameEndedPayload>(ServerEvents.gameEnded, (payload) => {
    setEnded(payload);
    sound.play("fanfare");
  });

  function toggleMute() {
    const next = !muted;
    sound.setMuted(next);
    setMuted(next);
  }

  if (!viewToken) {
    return (
      <div className="live-screen flex min-h-screen items-center justify-center px-4">
        <p className="rounded-2xl bg-white/10 px-6 py-4 text-white/80">
          Falta el token de presentación. Ábrelo desde la pantalla del anfitrión.
        </p>
      </div>
    );
  }

  const joinUrl =
    state && state.status === "WAITING"
      ? new URL(routeUrl(`live/join?pin=${state.pin}`), window.location.origin).toString()
      : "";

  return (
    <div className="live-screen relative flex min-h-screen flex-col px-6 py-8">
      <button
        type="button"
        onClick={toggleMute}
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white"
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {error && (
        <p className="mx-auto mb-4 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-100">{error}</p>
      )}

      <div className="mx-auto w-full max-w-5xl flex-1">
        {!state && <p className="text-center text-white/70">Conectando a la sesión…</p>}

        {state?.status === "WAITING" && !ended && (
          <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
            <p className="text-2xl font-bold text-white">{state.quizTitle}</p>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Únete con el PIN</p>
            <p className="text-7xl font-black tracking-[0.3em] text-white">{state.pin}</p>
            {joinUrl && <QrCode value={joinUrl} size={240} />}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {state.players.slice(0, 12).map((player) => (
                <div key={player.playerId} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                  <Avatar avatar={player.avatar} size="sm" />
                  <span className="text-sm text-white">{player.username}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-white/60">{state.players.length} jugador(es)</p>
          </div>
        )}

        {state?.status === "ACTIVE" && question && !ended && (
          <QuestionStage
            question={question}
            remaining={remaining}
            answeredCount={results?.answeredCount ?? 0}
            playerCount={state.players.length}
            results={results && results.questionId === question.questionId ? results : null}
          />
        )}

        {ended && (
          <div className="py-8">
            <h1 className="mb-8 text-center text-3xl font-black text-white">🏆 Resultado final</h1>
            <Podium podium={ended.podium} leaderboard={ended.leaderboard} />
          </div>
        )}
      </div>
    </div>
  );
}
