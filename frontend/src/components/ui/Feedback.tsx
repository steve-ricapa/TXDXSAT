import type { ReactNode } from "react";
import { Loader2, TriangleAlert, CircleCheck, Info, CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-accent", className)} aria-hidden />;
}

/** Centered loading state with an optional message. */
export function LoadingState({ label = "Cargando…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-sm text-ink-muted", className)}>
      <Spinner className="h-6 w-6" />
      <span>{label}</span>
    </div>
  );
}

/** Neutral "nothing here yet" panel. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <span className="rounded-full bg-white/5 p-3 text-ink-soft">{icon}</span>}
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_TONES: Record<AlertTone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-info/30 bg-info/10 text-info", Icon: Info },
  success: { cls: "border-success/30 bg-success/10 text-success", Icon: CircleCheck },
  warning: { cls: "border-warning/30 bg-warning/10 text-warning", Icon: TriangleAlert },
  danger: { cls: "border-danger/30 bg-danger/10 text-danger-readable", Icon: CircleAlert },
};

/** Inline notification / feedback banner. */
export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  const { cls, Icon } = ALERT_TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm", cls, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
