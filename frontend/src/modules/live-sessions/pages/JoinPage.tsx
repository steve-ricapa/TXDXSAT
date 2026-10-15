import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSocket } from "@/services/socket";
import { AVATARS, DEFAULT_AVATAR_ID } from "../lib/avatars";
import { ClientEvents, ServerEvents } from "../lib/protocol";
import type { PlayerJoinedAckPayload } from "../lib/protocol";
import { playerStore } from "../lib/storage";

/**
 * Player entry point (`/live/join`).
 *
 * Collects the 6-digit PIN, a display name and an avatar, then joins over
 * Socket.IO. The server assigns the player id and the UI moves on to the play
 * route carrying that id (persisted for reconnect on refresh).
 */
export function JoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pin, setPin] = useState(params.get("pin") ?? "");
  const [username, setUsername] = useState("");
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
    if (!canSubmit) return;
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
        socket.emit(ClientEvents.playerJoin, { pin, username: username.trim(), avatar });
        setTimeout(() => {
          cleanup();
          reject(new Error("El servidor no respondió. Inténtalo de nuevo."));
        }, 8000);
      });

      playerStore.save({
        playerId: ack.playerId,
        sessionId: ack.sessionId,
        pin,
        username: ack.username,
        avatar: ack.avatar,
      });
      navigate(`/live/play/${ack.sessionId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="live-screen flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-3xl bg-white/10 p-6 backdrop-blur">
        <header className="text-center">
          <h1 className="text-2xl font-extrabold text-white">Unirse a la sesión</h1>
          <p className="mt-1 text-sm text-white/60">Introduce el PIN que aparece en la pantalla.</p>
        </header>

        <label className="block">
          <span className="text-sm font-medium text-white/80">PIN</span>
          <input
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            className="mt-1 w-full rounded-xl bg-white/90 px-4 py-3 text-center text-3xl font-black tracking-[0.4em] text-slate-900"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white/80">Tu nombre</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value.slice(0, 24))}
            maxLength={24}
            placeholder="Ana"
            className="mt-1 w-full rounded-xl bg-white/90 px-4 py-3 text-lg font-semibold text-slate-900"
          />
        </label>

        <div>
          <span className="text-sm font-medium text-white/80">Tu avatar</span>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {AVATARS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAvatar(option.id)}
                className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition ${
                  avatar === option.id ? "ring-2 ring-white" : "opacity-70 hover:opacity-100"
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
          <p className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-100">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-[var(--color-brand-500)] py-3.5 text-lg font-bold text-white transition hover:bg-[var(--color-brand-600)] disabled:opacity-40"
        >
          {busy ? "Conectando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
