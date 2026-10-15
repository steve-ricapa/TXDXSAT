/**
 * Circular countdown ring driven by the server-provided deadline.
 *
 * The ring is presentational only: the server is authoritative and closes the
 * question when its own timer fires, so a drifted client can never extend play.
 */
export function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const safeTotal = Math.max(total, 1);
  const ratio = Math.max(0, Math.min(1, remaining / safeTotal));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const urgent = remaining <= 5;

  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-white/15" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={urgent ? "text-red-400 transition-[stroke-dashoffset] duration-200" : "text-emerald-400 transition-[stroke-dashoffset] duration-200"}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums ${
          urgent ? "text-red-300" : "text-white"
        }`}
      >
        {remaining}
      </span>
    </div>
  );
}
