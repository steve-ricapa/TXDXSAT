import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Award, CheckCircle2, Radio, Sparkles, Target } from "lucide-react";
import { buttonClass, LoadingState } from "@/components/ui";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { sortEmployeeResults, useEmployeeResults } from "../useEmployeeResults";

export function EmployeeHome() {
  const { user } = useAuth();
  const { results, loading, error } = useEmployeeResults();
  const firstName = user?.name.split(" ")[0];
  const stats = useMemo(() => {
    const completed = results.filter((result) => result.status === "FINISHED");
    const answers = completed.reduce((sum, result) => sum + result.answers, 0);
    const correct = completed.reduce((sum, result) => sum + result.correctCount, 0);
    return {
      completed: completed.length,
      active: results.length - completed.length,
      answers,
      correct,
      accuracy: answers ? Math.round((correct / answers) * 100) : 0,
      points: completed.reduce((sum, result) => sum + result.score, 0),
      best: completed.reduce((best, result) => Math.max(best, result.score), 0),
    };
  }, [results]);
  const recent = sortEmployeeResults(results).slice(0, 3);
  const insight = stats.answers === 0
    ? "Cuando completes tu primera sesión, aquí verás un consejo basado en tus respuestas."
    : stats.accuracy >= 80
      ? "¡Vas muy bien! Mantén el hábito y sigue poniendo a prueba tus conocimientos de seguridad."
      : stats.accuracy >= 60
        ? "Tienes una buena base. Revisa las explicaciones de tus respuestas para afianzar los temas."
        : "Cada sesión es una oportunidad para mejorar. Presta atención a las explicaciones y vuelve a intentarlo.";

  return (
    <div className="space-y-7 pb-6">
      <section className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/15 via-surface to-surface p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-accent"><Sparkles className="h-4 w-4" />Tu espacio de aprendizaje</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Hola{firstName ? `, ${firstName}` : ""} 👋</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">Tu progreso en seguridad, sesión a sesión. Participa, aprende de cada respuesta y mira cómo avanzas.</p>
          </div>
          <Link to="/live/join" className={buttonClass({ variant: "accent", size: "md" })}><Radio className="mr-2 h-4 w-4" />Entrar con PIN<ArrowRight className="ml-2 h-4 w-4" /></Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger-readable">No se pudieron cargar tus resultados. Vuelve a intentarlo más tarde.</div>
      ) : loading ? <div className="py-8"><LoadingState label="Preparando tu resumen de progreso..." /></div> : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de progreso">
            {[
              { label: "Sesiones completadas", value: stats.completed, icon: CheckCircle2, hint: stats.active ? `${stats.active} en curso o en sala` : "Tu actividad hasta hoy" },
              { label: "Precisión general", value: `${stats.accuracy}%`, icon: Target, hint: `${stats.answers} respuestas evaluadas` },
              { label: "Puntos acumulados", value: stats.points.toLocaleString("es-PE"), icon: Award, hint: `Mejor sesión: ${stats.best.toLocaleString("es-PE")} pts` },
              { label: "Respuestas correctas", value: stats.answers ? `${stats.correct}/${stats.answers}` : "—", icon: Activity, hint: "A través de tus sesiones" },
            ].map(({ label, value, icon: Icon, hint }) => (
              <article key={label} className="rounded-xl border border-border bg-surface p-4 shadow-sm shadow-black/10">
                <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-ink-muted">{label}</p><span className="rounded-lg bg-accent/10 p-2 text-accent"><Icon className="h-4 w-4" /></span></div>
                <p className="mt-3 text-2xl font-extrabold tabular-nums text-ink">{value}</p><p className="mt-1 text-[11px] text-ink-soft">{hint}</p>
              </article>
            ))}
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/10 to-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex items-center gap-3"><span className="rounded-lg bg-accent/15 p-2 text-accent"><Sparkles className="h-5 w-5" /></span><h2 className="font-bold text-ink">Tu enfoque</h2></div><p className="mt-3 text-sm leading-relaxed text-ink-muted">{insight}</p></div>
            <Link to="/live/join" className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-accent hover:underline">Seguir aprendiendo<ArrowRight className="h-4 w-4" /></Link>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-ink">Sesiones recientes</h2><p className="text-xs text-ink-muted">Tus últimas actividades</p></div><Link to="/employee/history" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">Ver historial completo<ArrowRight className="h-4 w-4" /></Link></div>
            {recent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center"><Radio className="mx-auto mb-3 h-8 w-8 text-accent" /><p className="font-semibold text-ink">Tu próxima sesión empieza aquí</p><p className="mt-1 text-sm text-ink-muted">Únete con el PIN que te comparta el anfitrión; tus resultados aparecerán aquí.</p></div>
            ) : <div className="grid gap-3 lg:grid-cols-3">{recent.map((result) => (
              <article key={result.sessionId} className="flex min-h-32 flex-col justify-between rounded-xl border border-border bg-surface p-4">
                <div><p className="line-clamp-2 text-sm font-bold text-ink">{result.quizTitle}</p><p className="mt-1 text-xs text-ink-muted">{result.status === "FINISHED" ? result.finishedAt ? new Date(result.finishedAt).toLocaleDateString("es-PE") : "Completada" : result.status === "ACTIVE" ? "En curso" : "En sala"}</p></div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs"><span className="text-ink-muted">{result.answers} respuestas</span><span className="font-bold text-accent">{result.status === "FINISHED" ? `${result.score} pts` : "Pendiente"}</span></div>
              </article>
            ))}</div>}
          </section>
          <p className="text-center text-xs text-ink-soft">Aquí se muestran tus sesiones y resultados reales. La capacitación por cursos aún no está disponible.</p>
        </>
      )}
    </div>
  );
}
