import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { myLiveResults, type MyLiveResult } from "@/modules/live-sessions/lib/api";
import { Radio } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { useAuth } from "@/modules/auth/context/AuthContext";

/**
 * Employee portal for live sessions and real session results.
 */
export function EmployeeHome() {
  const { user } = useAuth();
  const firstName = user?.name.split(" ")[0];
  const [results, setResults] = useState<MyLiveResult[]>([]);
  const [resultsError, setResultsError] = useState(false);

  useEffect(() => {
    let mounted = true;
    myLiveResults().then(({ results: entries }) => {
      if (mounted) setResults(entries);
    }).catch(() => {
      if (mounted) setResultsError(true);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Portal del empleado
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Hola{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Participa en sesiones en vivo y revisa tus resultados.
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Mis sesiones en vivo</h2>
          <Link to="/live/join" className={buttonClass({ variant: "accent", size: "sm" })}>Entrar con PIN</Link>
        </div>
        {resultsError ? <p className="text-sm text-ink-muted">No se pudieron cargar tus resultados. Vuelve a intentarlo más tarde.</p> : results.length === 0 ? <p className="border border-border p-5 text-sm text-ink-muted">Aún no tienes sesiones asociadas a tu cuenta.</p> : (
          <div className="divide-y divide-border border-y border-border">
            {results.map((result) => <div key={result.sessionId} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
              <div><p className="font-semibold text-ink">{result.quizTitle}</p><p className="text-ink-muted">{result.finishedAt ? new Date(result.finishedAt).toLocaleDateString("es") : "Sesión en curso"} · {result.answers} respuestas</p></div>
              <span className="font-bold tabular-nums text-accent">{result.status === "FINISHED" ? `${result.score} pts` : "Puntuación pendiente"}</span>
            </div>)}
          </div>
        )}
      </section>

      <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs text-ink-soft">
        <Radio className="mr-1 inline h-3.5 w-3.5" />
        La capacitación por cursos aún no está implementada; aquí se muestran tus sesiones y resultados reales.
      </p>
    </div>
  );
}
