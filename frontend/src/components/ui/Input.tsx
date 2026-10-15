import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-xl border border-border bg-[var(--color-field)] px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-ink-soft transition-colors focus:border-accent focus:outline-none focus:ring-2 " +
  "focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "appearance-none bg-no-repeat pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  const caption = (
    <span className="mb-1.5 block text-sm font-medium text-ink">
      {label}
      {required && <span className="ml-0.5 text-danger-readable">*</span>}
    </span>
  );
  const help = error ? (
    <span className="mt-1.5 block text-xs text-danger-readable">{error}</span>
  ) : hint ? (
    <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span>
  ) : null;

  if (htmlFor) {
    return (
      <div className={cn("block", className)}>
        <label htmlFor={htmlFor}>{caption}</label>
        {children}
        {help}
      </div>
    );
  }

  return (
    <label className={cn("block", className)}>
      {caption}
      {children}
      {help}
    </label>
  );
}

/** Convenience: a labelled input that wires up `id`/`aria` automatically. */
export type TextFieldProps = Omit<FieldProps, "children" | "htmlFor"> &
  InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} required={rest.required} className={className}>
      <Input id={id} aria-invalid={Boolean(error)} {...rest} />
    </Field>
  );
}
