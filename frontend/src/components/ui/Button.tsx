import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] shadow-sm",
  accent:
    "bg-accent text-[#04211f] font-bold hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)]",
  secondary: "bg-[var(--color-surface-raised)] text-ink border border-border hover:bg-card-hover",
  outline: "border border-border text-ink hover:bg-white/5 hover:border-accent/60",
  ghost: "text-ink-muted hover:bg-white/5 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-base",
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Shared class builder so `<Link>`/`<a>` can render as a button. */
export function buttonClass({ variant = "primary", size = "md", className }: ButtonClassOptions = {}): string {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={buttonClass({ variant, size, className })}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
