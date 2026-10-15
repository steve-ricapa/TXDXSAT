import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  username: string;
  avatar: string;
  score: number;
}

/** On-palette rank badges: accent (1), info (2), primary (3). */
const RANK_STYLES = [
  "bg-accent text-[#04211f]", // 1
  "bg-info text-[#04211f]", // 2
  "bg-primary text-white", // 3
];

/**
 * Animated leaderboard.
 *
 * Between questions the engine re-sorts players; this component animates the
 * reflow (FLIP: measure, translate, release) and shows an up/down badge so the
 * movement is legible from the back of a room.
 */
export function Leaderboard({
  entries,
  highlightPlayerId,
  compact = false,
  maxRows,
}: {
  entries: LeaderboardRow[];
  highlightPlayerId?: string | undefined;
  compact?: boolean;
  maxRows?: number;
}) {
  const limit = maxRows ?? (compact ? 5 : 10);
  const shown = entries.slice(0, limit);

  const refs = useRef(new Map<string, HTMLLIElement>());
  const prevPositions = useRef(new Map<string, number>());
  const prevRanks = useRef(new Map<string, number>());
  const [movement, setMovement] = useState<Record<string, number>>({});

  // Track rank deltas so a badge can show who climbed or fell.
  useEffect(() => {
    const deltas: Record<string, number> = {};
    for (const entry of entries) {
      const previous = prevRanks.current.get(entry.playerId);
      if (previous !== undefined && previous !== entry.rank) {
        deltas[entry.playerId] = previous - entry.rank; // positive => moved up
      }
    }
    prevRanks.current = new Map(entries.map((entry) => [entry.playerId, entry.rank]));
    setMovement(deltas);
  }, [entries]);

  // FLIP animation on reorder.
  useLayoutEffect(() => {
    const nextPositions = new Map<string, number>();
    refs.current.forEach((element, id) => {
      if (element) nextPositions.set(id, element.getBoundingClientRect().top);
    });

    prevPositions.current.forEach((previousTop, id) => {
      const element = refs.current.get(id);
      const nextTop = nextPositions.get(id);
      if (!element || nextTop === undefined || Math.abs(previousTop - nextTop) < 1) return;
      const delta = previousTop - nextTop;
      element.style.transition = "none";
      element.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        element.style.transition = "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)";
        element.style.transform = "";
      });
    });

    prevPositions.current = nextPositions;
  }, [shown]);

  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">Aún no hay jugadores.</p>;
  }

  return (
    <ol className="space-y-1.5">
      {shown.map((entry) => {
        const delta = movement[entry.playerId] ?? 0;
        const isSelf = entry.playerId === highlightPlayerId;
        return (
          <li
            key={entry.playerId}
            ref={(element) => {
              if (element) refs.current.set(entry.playerId, element);
              else refs.current.delete(entry.playerId);
            }}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
              isSelf ? "bg-accent/20 ring-2 ring-accent/60" : "game-chip"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black tabular-nums ${
                RANK_STYLES[entry.rank - 1] ?? "game-chip text-ink"
              }`}
            >
              {entry.rank}
            </span>
            <Avatar avatar={entry.avatar} size="sm" />
            <span className="flex-1 truncate font-semibold text-ink">{entry.username}</span>
            {delta !== 0 && (
              <span
                className={`text-xs font-bold tabular-nums ${
                  delta > 0 ? "text-success" : "text-danger-readable"
                }`}
                title={delta > 0 ? "Sube posiciones" : "Baja posiciones"}
              >
                {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
              </span>
            )}
            <span className="w-16 text-right font-black tabular-nums text-ink">{entry.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
