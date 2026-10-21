import { Clock3, Eye } from "lucide-react";
import type { MyLiveResult } from "@/modules/live-sessions/lib/api";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "Fecha pendiente";
}

export function SessionResultCard({ result, onViewDetail }: { result: MyLiveResult; onViewDetail: () => void }) {
  const finished = result.status === "FINISHED";
  const correct = Math.min(Math.max(result.correctCount, 0), result.answers);
  const incorrect = result.answers - correct;
  const correctPercent = result.answers ? Math.round((correct / result.answers) * 100) : 0;
  const incorrectPercent = result.answers ? 100 - correctPercent : 0;

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

          <button type="button" onClick={onViewDetail} aria-haspopup="dialog" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Eye className="h-4 w-4" /> Ver detalle de la sesión
          </button>
        </>
      )}
    </article>
  );
}
