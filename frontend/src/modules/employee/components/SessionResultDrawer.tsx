import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Clock3, RotateCcw, X, XCircle } from "lucide-react";
import { myLiveResultDetail, type MyLiveResult, type MyLiveResultDetail } from "@/modules/live-sessions/lib/api";

interface SessionResultDrawerProps {
  result: MyLiveResult | null;
  onClose: () => void;
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : "Fecha pendiente";
}

export function SessionResultDrawer({ result, onClose }: SessionResultDrawerProps) {
  const [detail, setDetail] = useState<MyLiveResultDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!result) return;
    let active = true;
    setDetail(null);
    setLoading(true);
    setError(false);
    myLiveResultDetail(result.sessionId)
      .then((response) => { if (active) setDetail(response.result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [result?.sessionId, retryCount]);

  useEffect(() => {
    if (!result) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [result?.sessionId, onClose]);

  if (!result) return null;

  const summary = detail ?? result;
  const correct = Math.min(Math.max(summary.correctCount, 0), summary.answers);
  const incorrect = summary.answers - correct;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar detalle de la sesión" onClick={onClose} className="absolute inset-0 bg-black/65" />
      <aside role="dialog" aria-modal="true" aria-labelledby="session-detail-title" className="drawer-in relative flex h-full w-full max-w-2xl flex-col border-l border-border bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-accent">Resultado de la sesión</p>
            <h2 id="session-detail-title" className="mt-2 text-xl font-extrabold leading-snug text-ink sm:text-2xl">{result.quizTitle}</h2>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted"><Clock3 className="h-4 w-4" />{formatDate(result.finishedAt)}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar detalle" className="rounded-lg p-2 text-ink-muted hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-background/50 p-3 text-center sm:gap-3">
            <div><p className="text-lg font-extrabold tabular-nums text-accent sm:text-xl">{summary.score}</p><p className="text-xs text-ink-muted">Puntos</p></div>
            <div><p className="text-lg font-extrabold tabular-nums text-emerald-300 sm:text-xl">{correct}</p><p className="text-xs text-ink-muted">Correctas</p></div>
            <div><p className="text-lg font-extrabold tabular-nums text-rose-300 sm:text-xl">{incorrect}</p><p className="text-xs text-ink-muted">Incorrectas</p></div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <h3 className="font-bold text-ink">Preguntas respondidas</h3>
            <span className="text-sm tabular-nums text-ink-muted">{summary.answers} en total</span>
          </div>

          {loading && <p role="status" className="text-sm text-ink-muted">Cargando preguntas…</p>}
          {error && (
            <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger-readable">
              <p>No se pudieron cargar las preguntas de esta sesión.</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-3 inline-flex items-center gap-2 font-semibold text-ink underline hover:text-accent"><RotateCcw className="h-4 w-4" />Reintentar</button>
            </div>
          )}
          {detail && (detail.questions.length > 0 ? (
            <ol className="space-y-3">
              {detail.questions.map((question) => (
                <li key={`${question.questionId}-${question.answerOrder}`} className="rounded-xl border border-border bg-background/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{question.answerOrder}. {question.questionText ?? "Pregunta anterior (contenido no disponible)"}</p>
                    {question.isCorrect ? <CheckCircle2 aria-label="Correcta" className="h-5 w-5 shrink-0 text-emerald-300" /> : <XCircle aria-label="Incorrecta" className="h-5 w-5 shrink-0 text-rose-300" />}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className={question.isCorrect ? "font-bold text-emerald-300" : "font-bold text-rose-300"}>{question.isCorrect ? "Correcta" : "Incorrecta"}</span>
                    <span className="tabular-nums text-ink-muted">{question.score} puntos</span>
                  </div>
                  {question.explanation && <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-ink-muted">{question.explanation}</p>}
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-ink-muted">No hay preguntas disponibles para esta sesión.</p>)}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
