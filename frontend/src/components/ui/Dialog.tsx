import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Accessible modal. Renders in a portal, closes on Escape / overlay click and
 * locks body scroll while open.
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.getClientRects().length > 0);

    (focusable()[0] ?? panelRef.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      } else if (event.key === "Tab") {
        const elements = focusable();
        if (!elements.length) {
          event.preventDefault();
          panelRef.current?.focus();
        } else if (event.shiftKey && document.activeElement === elements[0]) {
          event.preventDefault();
          elements.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === elements.at(-1)) {
          event.preventDefault();
          elements[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-2xl border border-border bg-[var(--color-surface)] shadow-2xl slide-up",
          className,
        )}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
              {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
