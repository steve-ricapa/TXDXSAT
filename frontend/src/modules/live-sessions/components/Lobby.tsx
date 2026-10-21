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
  starting = false,
}: {
  pin: string;
  joinUrl: string;
  quizTitle: string;
  questionCount: number;
  players: PlayerSnapshot[];
  role: "host" | "present" | "player";
  onStart?: () => void;
  starting?: boolean;
}) {
  const canStart = players.length > 0;

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-stretch">
      {/* Join panel */}
      <div className="game-panel slide-up flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-ink-muted">Únete con el PIN</p>
        <p className="text-6xl font-black tracking-[0.15em] text-ink drop-shadow-lg sm:text-7xl">{pin}</p>

        <div className="rounded-2xl bg-white p-3 shadow-2xl">
          <QrCode value={joinUrl} size={180} />
        </div>
        <p className="max-w-xs break-all text-center text-xs text-ink-muted">{joinUrl}</p>

        {role === "host" && onStart && (
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || starting}
            className={`mt-2 w-full max-w-sm rounded-2xl px-8 py-5 text-2xl font-black uppercase tracking-wide transition ${
              canStart
                ? "bg-accent text-[#04211f] shadow-[0_8px_0_0_#00a79f] hover:brightness-110 active:translate-y-1 active:shadow-none"
                : "game-chip cursor-not-allowed text-ink-soft"
            }`}
          >
            {starting ? "Preparando…" : canStart ? "Empezar" : "Esperando jugadores…"}
          </button>
        )}
        {role === "host" && !canStart && (
          <p className="text-xs text-ink-soft">Necesitas al menos un jugador para empezar.</p>
        )}
      </div>

      {/* Players panel */}
      <div className="game-panel slide-up flex min-h-0 flex-1 flex-col gap-4 rounded-3xl p-6 sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-ink sm:text-2xl">{quizTitle}</h2>
            <p className="text-sm text-ink-muted">{questionCount} preguntas</p>
          </div>
          <div className="game-chip rounded-2xl px-4 py-2 text-center">
            <p className="text-3xl font-black tabular-nums text-ink">{players.length}</p>
            <p className="text-[0.65rem] uppercase tracking-widest text-ink-muted">jugadores</p>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="text-4xl">📱</span>
            <p className="font-semibold text-ink-muted">Esperando jugadores…</p>
            <p className="text-sm text-ink-soft">Escanea el código o introduce el PIN en tu móvil.</p>
          </div>
        ) : (
          <ul className="grid min-h-0 w-full flex-1 content-start grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {players.map((player) => (
              <li
                key={player.playerId}
                className="game-chip flex min-w-0 items-center gap-2 rounded-xl px-3 py-2"
              >
                <Avatar avatar={player.avatar} size="sm" />
                <span className="truncate text-sm font-semibold text-ink">{player.username}</span>
                {!player.connected && <span className="text-[0.6rem] text-ink-soft">off</span>}
              </li>
            ))}
          </ul>
        )}

        {role === "player" && (
          <p className="game-inset rounded-xl px-4 py-3 text-center text-sm font-semibold text-ink-muted">
            ¡Estás dentro! Mira la pantalla del anfitrión.
          </p>
        )}
      </div>
    </div>
  );
}
