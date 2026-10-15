import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-base font-semibold leading-tight text-ink", className)} {...rest}>
      {children}
    </h2>
  );
}

export function CardDescription({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1 text-sm text-ink-muted", className)} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-3 border-t border-border px-5 py-4", className)} {...rest}>
      {children}
    </div>
  );
}

/** Compact stat tile used across the admin/superadmin dashboards. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "accent",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "accent" | "info" | "success" | "warning";
  className?: string;
}) {
  const tones: Record<string, string> = {
    accent: "bg-accent-soft text-accent",
    info: "bg-info/15 text-info",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  };
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
        {icon && <span className={cn("rounded-lg p-2", tones[tone])}>{icon}</span>}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </Card>
  );
}
