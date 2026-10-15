import { useMemo } from "react";

const COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#8b5cf6", "#f472b6", "#38bdf8"];

/**
 * Lightweight CSS confetti — deterministic pieces, no canvas and no animation
 * library. Purely decorative; hidden entirely when the user prefers reduced
 * motion (see index.css).
 */
export function Confetti({ pieces = 90 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        // Deterministic-ish pseudo random so renders are stable per mount.
        const rand = (seed: number) => ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
        return {
          id: i,
          left: `${Math.round(rand(i + 1) * 100)}%`,
          delay: `${(rand(i + 2) * 2.5).toFixed(2)}s`,
          duration: `${(2.6 + rand(i + 3) * 2.6).toFixed(2)}s`,
          dx: `${Math.round((rand(i + 4) - 0.5) * 220)}px`,
          rot: `${Math.round(360 + rand(i + 5) * 900)}deg`,
          color: COLORS[i % COLORS.length],
          width: `${6 + Math.round(rand(i + 6) * 6)}px`,
          height: `${10 + Math.round(rand(i + 7) * 10)}px`,
        };
      }),
    [pieces],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((item) => (
        <span
          key={item.id}
          className="confetti-piece"
          style={{
            left: item.left,
            backgroundColor: item.color,
            width: item.width,
            height: item.height,
            ["--delay" as string]: item.delay,
            ["--dur" as string]: item.duration,
            ["--dx" as string]: item.dx,
            ["--rot" as string]: item.rot,
          }}
        />
      ))}
    </div>
  );
}
