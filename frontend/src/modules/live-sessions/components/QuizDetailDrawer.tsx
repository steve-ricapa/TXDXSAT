import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { liveApi, type QuizDetail } from "../lib/api";

interface QuizDetailDrawerProps {
  quizId: string | null;
  onClose: () => void;
}

export function QuizDetailDrawer({ quizId, onClose }: QuizDetailDrawerProps) {
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!quizId) return;
    let active = true;
    setQuiz(null);
    setError(null);
    liveApi.getQuizDetail(quizId).then((result) => {
      if (active) { setQuiz(result); setError(null); }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el cuestionario");
    });
    return () => { active = false; };
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [quizId, onClose]);

  if (!quizId) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar detalle del cuestionario" onClick={onClose} className="absolute inset-0 bg-black/65" />
      <aside role="dialog" aria-modal="true" aria-label="Detalle del cuestionario" className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">{quiz?.origin === "MIXED" ? "Mezcla guardada" : "Cuestionario original"} · solo lectura</p>
            <h2 className="mt-2 text-xl font-extrabold text-ink">{quiz?.title ?? "Cargando detalle…"}</h2>
            {quiz && <p className="mt-1 text-sm text-ink-muted">{quiz.questions.length} preguntas · Sus tiempos no cambiarán al preparar una mezcla.</p>}
            {quiz && <p className="mt-1 text-xs text-ink-muted">Creado por {quiz.creatorName ?? "autor no registrado"}</p>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-ink-muted hover:bg-surface-raised hover:text-ink"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-xl border border-danger/40 p-4 text-sm text-danger-readable">{error}</p>}
          {quiz?.description && <p className="text-sm text-ink-muted">{quiz.description}</p>}
          {quiz?.questions.map((question, index) => <section key={question.id} className="rounded-xl border border-border bg-surface-raised/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-ink">{index + 1}. {question.text}</h3>
              <span className="shrink-0 rounded-full border border-border px-2 py-1 text-xs text-ink-muted">{question.timeSec} s</span>
            </div>
            {question.options.length > 0 && <ol className="mt-3 space-y-1 text-sm text-ink-muted">
              {question.options.map((option, optionIndex) => <li key={optionIndex} className={question.correctIndex === optionIndex || question.correctIndices?.includes(optionIndex) ? "font-semibold text-accent" : ""}>
                {String.fromCharCode(65 + optionIndex)}. {option}
              </li>)}
            </ol>}
            {question.explanation && <p className="mt-3 border-t border-border pt-3 text-xs text-ink-muted">{question.explanation}</p>}
          </section>)}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
