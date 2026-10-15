import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "accent" | "primary" | "success" | "warning" | "danger" | "info";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-white/5 text-ink-muted border-border",
  accent: "bg-accent-soft text-accent border-accent/30",
  primary: "bg-primary/25 text-info border-primary/50",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger-readable border-danger/30",
  info: "bg-info/15 text-info border-info/30",
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
