import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { routeUrl } from "@/lib/env";
import { getSocket } from "@/services/socket";
import { QuestionStage } from "../components/QuestionStage";
import { Lobby } from "../components/Lobby";
import { LiveBackground } from "../components/LiveBackground";
import { Podium } from "../components/Podium";
import { SoundControls } from "../components/SoundControls";
import { useCountdown } from "../hooks/useCountdown";
import { useSocketEvent } from "../hooks/useSocketEvent";
import { ClientEvents, ServerEvents } from "../lib/protocol";
import type {
  AnswerCountPayload,
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
 * opened on a shared machine without granting game control. Designed for
 * 1920×1080: no scrolling, everything scales with the viewport.
 */
export function PresentPage() {
  const { sessionId = "" } = useParams();
  const [params] = useSearchParams();
  const viewToken = params.get("token") ?? hostStore.load(sessionId)?.viewToken ?? null;

  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [ended, setEnded] = useState<GameEndedPayload | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  useSocketEvent<{ countdownSeconds: number }>(ServerEvents.gameStarted, () => {
    setEnded(null);
    setQuestion(null);
    setResults(null);
  });

  useSocketEvent<{ seconds: number }>(ServerEvents.gameCountdown, (payload) => {
    setCountdown(payload.seconds);
    sound.play("heartbeat");
  });

  useSocketEvent<PublicQuestion>(ServerEvents.gameQuestion, (payload) => {
    setQuestion(payload);
    setResults(null);
    setAnsweredCount(0);
    setCountdown(null);
    sound.play("submit");
  });

  useSocketEvent<AnswerCountPayload>(ServerEvents.gameAnswerCount, (payload) => {
    setAnsweredCount(payload.answeredCount);
  });

  useSocketEvent<ResultsPayload>(ServerEvents.gameResults, (payload) => {
    setResults(payload);
    sound.play("correct");
  });

  useSocketEvent<GameEndedPayload>(ServerEvents.gameEnded, (payload) => {
    setEnded(payload);
    sound.stopMusic();
    sound.play("fanfare");
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

  // Background music follows the game phase.
  useEffect(() => {
    if (ended) {
      sound.stopMusic();
      return;
    }
    if (state?.status === "WAITING") sound.startMusic("lobby");
    else if (state?.status === "ACTIVE" && question) sound.startMusic("question");
  }, [state?.status, question, ended]);

  useEffect(() => () => sound.stopMusic(), []);

  if (!viewToken) {
    return (
      <div className="live-screen flex h-screen items-center justify-center px-4">
        <p className="rounded-2xl bg-black/30 px-6 py-4 text-white/80 backdrop-blur">
          Falta el token de presentación. Ábrelo desde la pantalla del anfitrión.
        </p>
      </div>
    );
  }

  const joinUrl =
    state && state.status === "WAITING"
      ? new URL(routeUrl(`live/join?pin=${state.pin}`), window.location.origin).toString()
      : "";

  const revealed = results !== null && question !== null && results.questionId === question.questionId;

  return (
    <div className="live-screen flex h-screen flex-col overflow-hidden">
      <LiveBackground />

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <SoundControls />
      </div>

      {error && (
        <p className="relative z-10 mx-auto mt-3 rounded-xl bg-red-500/25 px-4 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <div className="relative z-0 mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-6 py-6">
        {!state && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-lg text-white/70">Conectando a la sesión…</p>
          </div>
        )}

        {state?.status === "WAITING" && !ended && (
          <div className="flex flex-1 items-center">
            <Lobby
              pin={state.pin}
              joinUrl={joinUrl}
              quizTitle={state.quizTitle}
              questionCount={state.questionCount}
              players={state.players}
              role="present"
            />
          </div>
        )}

        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <span key={countdown} className="drop-in text-[12rem] font-black leading-none text-white">
              {countdown}
            </span>
          </div>
        )}

        {state?.status === "ACTIVE" && question && !ended && (
          <div className="min-h-0 flex-1">
            <QuestionStage
              question={question}
              remaining={remaining}
              answeredCount={answeredCount}
              playerCount={state.players.length}
              results={revealed ? results : null}
            />
          </div>
        )}

        {state?.status === "ACTIVE" && !question && !ended && countdown === null && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-2xl font-bold text-white/80">¡Preparados!</p>
          </div>
        )}

        {ended && (
          <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
            <h1 className="mb-6 text-center text-4xl font-black text-white">🏆 Resultado final</h1>
            <Podium podium={ended.podium} leaderboard={ended.leaderboard} playSound={false} />
          </div>
        )}
      </div>
    </div>
  );
}
