import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "success" | "warning" | "danger" | "info";
  className?: string;
  label?: string;
}) {
  const safeMax = Math.max(max, 1);
  const pct = Math.max(0, Math.min(100, Math.round((value / safeMax) * 100)));
  const tones: Record<string, string> = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
  };
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
          <span>{label}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-white/8"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tones[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
