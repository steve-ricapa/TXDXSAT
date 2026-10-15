import type { ReactNode } from "react";

export interface PlaceholderPageProps {
  portal: string;
  title: string;
  description: string;
  children?: ReactNode;
}

/** Temporary portal screen used by the Fase 1 routing verification. */
export function PlaceholderPage({ portal, title, description, children }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-brand-600)]">
          Portal {portal}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-[var(--color-ink-muted)]">{description}</p>
      </header>
      {children}
    </div>
  );
}
