import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { LoadingState } from "@/components/ui";
import { SessionResultCard } from "../components/SessionResultCard";
import { sortEmployeeResults, useEmployeeResults } from "../useEmployeeResults";

const PAGE_SIZE = 6;

export function EmployeeHistory() {
  const { results, loading, error } = useEmployeeResults();
  const [page, setPage] = useState(1);
  const activity = sortEmployeeResults(results);
  const pageCount = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = activity.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/employee" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" />Mi capacitación</Link>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Historial de sesiones</h1>
          <p className="mt-1 text-sm text-ink-muted">Revisa tus resultados y las preguntas de cada sesión completada.</p>
        </div>
        <Link to="/live/join" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-[#04211f] hover:bg-[var(--color-accent-hover)]"><Radio className="h-4 w-4" />Entrar con PIN</Link>
      </header>

      {loading ? <LoadingState label="Cargando historial..." /> : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger-readable">No se pudo cargar el historial. Vuelve a intentarlo más tarde.</div>
      ) : activity.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center"><Radio className="mx-auto mb-3 h-8 w-8 text-accent" /><p className="font-semibold text-ink">Aún no tienes sesiones</p><p className="mt-1 text-sm text-ink-muted">Cuando participes en un quiz, aparecerá aquí.</p></div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm text-ink-muted">
            {activity.length} {activity.length === 1 ? "sesión registrada" : "sesiones registradas"} · {activity.filter((result) => result.status === "FINISHED").length} completadas
          </div>
          <div className="space-y-3">{visible.map((result) => <SessionResultCard key={result.sessionId} result={result} />)}</div>
          {activity.length > PAGE_SIZE && (
            <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4" aria-label="Paginación del historial">
              <p className="text-xs text-ink-muted">Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, activity.length)} de {activity.length} sesiones</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Anterior</button>
                <span className="min-w-16 text-center text-xs font-semibold tabular-nums text-ink-muted">{currentPage} / {pageCount}</span>
                <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40">Siguiente<ChevronRight className="h-4 w-4" /></button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
