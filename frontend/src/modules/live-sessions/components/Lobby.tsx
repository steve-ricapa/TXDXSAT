import type { PlayerSnapshot } from "../lib/protocol";
import { Avatar } from "./Avatar";
import { QrCode } from "./QrCode";

/**
 * Shared waiting room for host, presenter and players.
 *
 * Big PIN + QR for joining, an animated participant grid and a prominent start
 * button — designed to read clearly on a projector from across a room.
 */
export function Lobby({
  pin,
  joinUrl,
  quizTitle,
  questionCount,
  players,
  role,
  onStart,
}: {
  pin: string;
  joinUrl: string;
  quizTitle: string;
  questionCount: number;
  players: PlayerSnapshot[];
  role: "host" | "present" | "player";
  onStart?: () => void;
}) {
  const canStart = players.length > 0;

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-stretch">
      {/* Join panel */}
      <div className="slide-up flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl bg-black/25 p-6 backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">Únete con el PIN</p>
        <p className="text-6xl font-black tracking-[0.15em] text-white drop-shadow-lg sm:text-7xl">{pin}</p>

        <div className="rounded-2xl bg-white p-3 shadow-2xl">
          <QrCode value={joinUrl} size={180} />
        </div>
        <p className="max-w-xs break-all text-center text-xs text-white/60">{joinUrl}</p>

        {role === "host" && onStart && (
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className={`mt-2 w-full max-w-sm rounded-2xl px-8 py-5 text-2xl font-black uppercase tracking-wide text-white transition ${
              canStart
                ? "bg-emerald-500 shadow-[0_8px_0_0_#166534] hover:brightness-110 active:translate-y-1 active:shadow-none"
                : "cursor-not-allowed bg-white/15 text-white/50"
            }`}
          >
            {canStart ? "Empezar" : "Esperando jugadores…"}
          </button>
        )}
        {role === "host" && !canStart && (
          <p className="text-xs text-white/50">Necesitas al menos un jugador para empezar.</p>
        )}
      </div>

      {/* Players panel */}
      <div className="slide-up flex flex-1 flex-col gap-4 rounded-3xl bg-black/25 p-6 backdrop-blur sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">{quizTitle}</h2>
            <p className="text-sm text-white/60">{questionCount} preguntas</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-2 text-center">
            <p className="text-3xl font-black tabular-nums text-white">{players.length}</p>
            <p className="text-[0.65rem] uppercase tracking-widest text-white/60">jugadores</p>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="text-4xl">📱</span>
            <p className="font-semibold text-white/80">Esperando jugadores…</p>
            <p className="text-sm text-white/50">Escanea el código o introduce el PIN en tu móvil.</p>
          </div>
        ) : (
          <ul className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {players.map((player, index) => (
              <li
                key={player.playerId}
                className="stagger flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2"
                style={{ ["--i" as string]: index % 12 }}
              >
                <Avatar avatar={player.avatar} size="sm" />
                <span className="truncate text-sm font-semibold text-white">{player.username}</span>
                {!player.connected && <span className="text-[0.6rem] text-white/40">off</span>}
              </li>
            ))}
          </ul>
        )}

        {role === "player" && (
          <p className="rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white/80">
            ¡Estás dentro! Mira la pantalla del anfitrión.
          </p>
        )}
      </div>
    </div>
  );
}
