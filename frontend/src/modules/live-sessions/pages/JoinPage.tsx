import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getSocket } from "@/services/socket";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { getToken } from "@/modules/auth/lib/auth-store";
import { LiveBackground } from "../components/LiveBackground";
import { SoundControls } from "../components/SoundControls";
import { AVATARS, DEFAULT_AVATAR_ID } from "../lib/avatars";
import { ClientEvents, ServerEvents } from "../lib/protocol";
import type { PlayerJoinedAckPayload } from "../lib/protocol";
import { playerStore } from "../lib/storage";
import { liveErrorMessage } from "../lib/error-message";

/**
 * Player entry point (`/live/join`).
 *
 * Collects the 6-digit PIN, a display name and an avatar, then joins over
 * Socket.IO. The server assigns the player id and the UI moves on to the play
 * route carrying that id (persisted for reconnect on refresh).
 */
export function JoinPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pin, setPin] = useState(params.get("pin") ?? "");
  const [username, setUsername] = useState(() => user?.name.slice(0, 24) ?? "");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR_ID);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!params.get("pin")) {
      const match = /pin=(\d{6})/.exec(window.location.search);
      if (match?.[1]) setPin(match[1]);
    }
  }, [params]);

  const canSubmit = /^\d{6}$/.test(pin) && username.trim().length > 0 && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !user) return;
    setBusy(true);
    setError(null);

    const socket = getSocket();
    try {
      const ack = await new Promise<PlayerJoinedAckPayload>((resolve, reject) => {
        const cleanup = () => {
          socket.off(ServerEvents.playerJoinedAck, onJoined);
          socket.off(ServerEvents.error, onError);
          socket.off(ServerEvents.playerError, onError);
        };
        const onJoined = (payload: PlayerJoinedAckPayload) => {
          cleanup();
          resolve(payload);
        };
        const onError = (payload: { message?: string }) => {
          cleanup();
          reject(new Error(payload?.message ?? "No se pudo unir a la sesión"));
        };
        socket.on(ServerEvents.playerJoinedAck, onJoined);
        socket.on(ServerEvents.error, onError);
        socket.on(ServerEvents.playerError, onError);
        socket.emit(ClientEvents.playerJoin, { pin, username: username.trim(), avatar, token: getToken() });
        setTimeout(() => {
          cleanup();
          reject(new Error("El servidor no respondió. Inténtalo de nuevo."));
        }, 8000);
      });

      playerStore.save({
        playerId: ack.playerId,
        userId: user.id,
        sessionId: ack.sessionId,
        pin,
        username: ack.username,
        avatar: ack.avatar,
      });
      navigate(`/live/play/${ack.sessionId}`, { replace: true });
    } catch (err) {
      setError(liveErrorMessage(err instanceof Error ? err.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="live-screen flex min-h-screen flex-col">
      <LiveBackground />
      <header className="relative z-10 flex items-center justify-between px-5 py-3">
        <Link to="/" className="text-sm font-bold text-ink hover:text-accent hover:underline">
          TXDXSAT
        </Link>
        <SoundControls compact />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6">
        <form onSubmit={submit} className="game-panel slide-up w-full max-w-md space-y-5 rounded-3xl p-6 sm:p-8">
          <header className="text-center">
            <h1 className="text-3xl font-black text-ink">Unirse a la sesión</h1>
            <p className="mt-1 text-sm text-ink-muted">Entras con tu cuenta; introduce el PIN para que tu progreso quede asociado a ella.</p>
          </header>

          <label className="block">
            <span className="text-sm font-medium text-ink">PIN</span>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="000000"
              className="mt-1 w-full rounded-2xl border border-border bg-[var(--color-field)] px-3 py-3 text-center text-2xl sm:text-3xl font-black tracking-[0.25em] sm:tracking-[0.4em] text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">Tu nombre</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.slice(0, 24))}
              maxLength={24}
              placeholder="Ej. Ana"
              className="mt-1 w-full rounded-2xl border border-border bg-[var(--color-field)] px-4 py-3 text-lg font-semibold text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-ink">Tu avatar</span>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {AVATARS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAvatar(option.id)}
                  className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition ${
                    avatar === option.id ? "ring-4 ring-accent" : "opacity-70 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: `${option.color}33` }}
                  aria-label={option.id}
                >
                  {option.emoji}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="mx-auto max-w-sm border-l-2 border-danger bg-danger/5 px-3 py-2 text-xs leading-relaxed text-danger-readable">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-accent py-4 text-lg font-black uppercase tracking-wide text-[#04211f] shadow-[0_6px_0_0_#00a79f] transition enabled:hover:brightness-110 enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
          >
            {busy ? "Conectando…" : "Entrar"}
          </button>

          <p className="text-center text-xs text-ink-soft">
            ¿Eres anfitrión? <Link to="/live/host" className="underline hover:text-accent">Crear sesión</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
