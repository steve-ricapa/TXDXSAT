import { useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";
import { myLiveResultDetail, type MyLiveResult, type MyLiveResultDetail } from "@/modules/live-sessions/lib/api";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "Fecha pendiente";
}

export function SessionResultCard({ result }: { result: MyLiveResult }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<MyLiveResultDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const finished = result.status === "FINISHED";
  const correct = Math.min(Math.max(result.correctCount, 0), result.answers);
  const incorrect = result.answers - correct;
  const correctPercent = result.answers ? Math.round((correct / result.answers) * 100) : 0;
  const incorrectPercent = result.answers ? 100 - correctPercent : 0;

  async function loadDetail() {
    setLoading(true);
    setError(false);
    try {
      const response = await myLiveResultDetail(result.sessionId);
      setDetail(response.result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggleDetail() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (!detail && !loading) void loadDetail();
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-ink">{result.quizTitle}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <Clock3 className="h-3.5 w-3.5" />
            {finished ? formatDate(result.finishedAt) : result.status === "ACTIVE" ? "Sesión en curso" : "Esperando inicio"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${finished ? "bg-emerald-500/10 text-emerald-300" : "bg-accent/10 text-accent"}`}>
          {finished ? "Completada" : "En vivo"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-ink-muted">{result.answers} respuestas</span>
        <span className="font-extrabold tabular-nums text-accent">{finished ? `${result.score} puntos` : "Puntuación pendiente"}</span>
      </div>

      {finished && (
        <>
          {result.answers > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2" aria-label={`${correctPercent}% correctas y ${incorrectPercent}% incorrectas`}>
              <div>
                <div className="mb-1 flex justify-between gap-2 text-xs"><span className="text-emerald-300">Correctas · {correct}/{result.answers}</span><span className="font-bold tabular-nums text-emerald-300">{correctPercent}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${correctPercent}%` }} /></div>
              </div>
              <div>
                <div className="mb-1 flex justify-between gap-2 text-xs"><span className="text-rose-300">Incorrectas · {incorrect}/{result.answers}</span><span className="font-bold tabular-nums text-rose-300">{incorrectPercent}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-rose-400" style={{ width: `${incorrectPercent}%` }} /></div>
              </div>
            </div>
          ) : <p className="mt-3 text-xs text-ink-muted">No hay respuestas registradas en esta sesión.</p>}

          {result.answers > 0 && (
            <>
              <button type="button" onClick={toggleDetail} aria-expanded={expanded} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
                {expanded ? "Ocultar preguntas" : "Ver preguntas respondidas"}
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <div className="mt-4 border-t border-border pt-4">
                  {loading ? <p className="text-sm text-ink-muted">Cargando preguntas...</p> : error ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-danger-readable">
                      <span>No se pudieron cargar las preguntas.</span>
                      <button type="button" onClick={() => void loadDetail()} className="font-semibold underline">Reintentar</button>
                    </div>
                  ) : detail?.questions.length ? (
                    <ol className="space-y-2">
                      {detail.questions.map((question) => (
                        <li key={`${question.questionId}-${question.answerOrder}`} className="rounded-lg border border-border bg-background/50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{question.answerOrder}. {question.questionText ?? "Pregunta anterior (contenido no disponible)"}</p>
                            <span className={`text-xs font-bold ${question.isCorrect ? "text-emerald-300" : "text-rose-300"}`}>{question.isCorrect ? "Correcta" : "Incorrecta"}</span>
                          </div>
                          <p className="mt-1 text-xs text-ink-muted">{question.score} puntos</p>
                          {question.explanation && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{question.explanation}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : <p className="text-sm text-ink-muted">No hay preguntas disponibles para esta sesión.</p>}
                </div>
              )}
            </>
          )}
        </>
      )}
    </article>
  );
}
