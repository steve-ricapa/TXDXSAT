/**
 * Circular countdown ring driven by the server-provided deadline.
 *
 * Presentational only: the server is authoritative and closes the question when
 * its own timer fires, so a drifted client can never extend play. The ring shifts
 * accent → warning → danger and pulses in the last seconds.
 */
export function TimerRing({
  remaining,
  total,
  size = 132,
  label,
}: {
  remaining: number;
  total: number;
  size?: number;
  label?: string;
}) {
  const safeTotal = Math.max(total, 1);
  const ratio = Math.max(0, Math.min(1, remaining / safeTotal));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const urgent = remaining <= 5;
  const warning = remaining <= 10 && !urgent;

  const strokeClass = urgent ? "text-danger" : warning ? "text-warning" : "text-accent";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative ${urgent ? "urgent" : ""}`}
        style={{ width: size, height: size }}
        role="timer"
        aria-live="off"
      >
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-ink/15"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className={`${strokeClass} transition-[stroke-dashoffset] duration-300 ease-linear`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-black tabular-nums leading-none ${
              urgent ? "text-danger" : "text-ink"
            }`}
            style={{ fontSize: size * 0.36 }}
          >
            {remaining}
          </span>
          {label && <span className="mt-1 text-[0.6rem] uppercase tracking-widest text-ink-muted">{label}</span>}
        </div>
      </div>
    </div>
  );
}
