import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { myLiveResults, type MyLiveResult } from "@/modules/live-sessions/lib/api";
import {
  Award,
  BookOpen,
  CircleCheck,
  Clock,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge, buttonClass, Card, ProgressBar, StatCard } from "@/components/ui";
import { useAuth } from "@/modules/auth/context/AuthContext";

/**
 * Employee portal. The learning content arrives in a later phase; the shell,
 * metrics and cards below demonstrate the visual language with sample data.
 */
const courses = [
  {
    title: "Fundamentos de phishing",
    description: "Reconoce correos fraudulentos y enlaces sospechosos.",
    progress: 100,
    status: "completed" as const,
    minutes: 15,
  },
  {
    title: "Contraseñas y MFA",
    description: "Buenas prácticas de autenticación y gestores de contraseñas.",
    progress: 60,
    status: "in-progress" as const,
    minutes: 20,
  },
  {
    title: "Ingeniería social",
    description: "Cómo detectar intentos de manipulación en el día a día.",
    progress: 0,
    status: "locked" as const,
    minutes: 25,
  },
];

const badges = [
  { id: "phishing", label: "Anti-phishing", icon: ShieldCheck, earned: true },
  { id: "mfa", label: "Guardián MFA", icon: Lock, earned: true },
  { id: "streak", label: "Racha de 5", icon: TrendingUp, earned: false },
  { id: "top", label: "Top del mes", icon: Award, earned: false },
];

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
        <Badge variant="accent">
          <Sparkles className="h-3.5 w-3.5" />
          Vista demo · nivel Guardián
        </Badge>
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

      <p className="border-t border-border pt-5 text-sm text-ink-muted">Los cursos, métricas e insignias a continuación son una demostración; no representan tu progreso real.</p>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Progreso global" value="53%" hint="Meta del trimestre: 80%" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Cursos" value="1 / 3" hint="Completados este mes" icon={<BookOpen className="h-4 w-4" />} tone="info" />
        <StatCard label="Insignias" value="2" hint="Sigue así para desbloquear más" icon={<Award className="h-4 w-4" />} tone="warning" />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ink">Capacitaciones · ejemplo</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {courses.map((course) => {
            const locked = course.status === "locked";
            const completed = course.status === "completed";
            return (
              <Card key={course.title} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex rounded-xl bg-accent-soft p-2.5 text-accent">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <Badge variant={completed ? "success" : locked ? "neutral" : "info"}>
                    {completed ? "Completado" : locked ? "Bloqueado" : "En curso"}
                  </Badge>
                </div>
                <h3 className="mt-4 font-semibold text-ink">{course.title}</h3>
                <p className="mt-1 flex-1 text-sm text-ink-muted">{course.description}</p>
                <div className="mt-4 space-y-3">
                  <ProgressBar value={course.progress} tone={completed ? "success" : "accent"} label="Progreso" />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <Clock className="h-3.5 w-3.5" />
                      {course.minutes} min
                    </span>
                    {locked ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                        <Lock className="h-4 w-4" /> Bloqueado
                      </span>
                    ) : (
                      <span className={buttonClass({ variant: completed ? "outline" : "accent", size: "sm" })}>
                        {completed ? <CircleCheck className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {completed ? "Repasar" : "Continuar"}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ink">Insignias · ejemplo</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {badges.map((badge) => (
            <Card
              key={badge.id}
              className={
                badge.earned
                  ? "flex flex-col items-center gap-2 p-5 text-center"
                  : "flex flex-col items-center gap-2 p-5 text-center opacity-50"
              }
            >
              <span
                className={
                  badge.earned
                    ? "inline-flex rounded-full bg-accent-soft p-3 text-accent"
                    : "inline-flex rounded-full bg-white/5 p-3 text-ink-soft"
                }
              >
                <badge.icon className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold text-ink">{badge.label}</span>
              <span className="text-xs text-ink-soft">{badge.earned ? "Obtenida" : "Bloqueada"}</span>
            </Card>
          ))}
        </div>
      </section>

      <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs text-ink-soft">
        Contenido de demostración — la gestión real de cursos llega en una fase posterior.
      </p>
    </div>
  );
}
