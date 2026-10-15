import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Pencil,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, LoadingState, ProgressBar, StatCard } from "@/components/ui";
import { useAuth } from "@/modules/auth/context/AuthContext";
import {
  tenantsApi,
  type TenantAnalytics,
  type TenantSummary,
} from "@/modules/tenants/lib/api";

export function AdminHome() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "SUPERADMIN";
  const [searchParams] = useSearchParams();
  const tenantFromUrl = searchParams.get("tenant");

  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [analytics, setAnalytics] = useState<TenantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"collaborators" | "quizzes">("collaborators");
  const [searchEmployee, setSearchEmployee] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");

  // 1. Load accessible tenants list
  useEffect(() => {
    let mounted = true;
    tenantsApi
      .listTenants()
      .then((data) => {
        if (!mounted) return;
        setTenants(data.tenants);
        if (data.tenants.length > 0) {
          // If navigated from superadmin with ?tenant=, use that; otherwise use own tenant or default
          const defaultTenant =
            (tenantFromUrl ? data.tenants.find((t) => t.id === tenantFromUrl) : null) ||
            data.tenants.find((t) => t.id === user?.tenantId) ||
            data.tenants.find((t) => t.slug === "acme-corp") ||
            data.tenants[0];
          if (defaultTenant) {
            setSelectedTenantId(defaultTenant.id);
          }
        }
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Error al cargar organizaciones");
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  // 2. Load analytics for selected tenant
  useEffect(() => {
    if (!selectedTenantId) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    tenantsApi
      .getTenantAnalytics(selectedTenantId)
      .then((data) => {
        if (!mounted) return;
        setAnalytics(data);
        if (data.quizzes.length > 0) {
          setSelectedQuizId(data.quizzes[0].id);
        }
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "No se pudieron obtener métricas");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedTenantId]);

  // Filtered employees for search
  const filteredEmployees = useMemo(() => {
    if (!analytics) return [];
    if (!searchEmployee.trim()) return analytics.employees;
    const term = searchEmployee.toLowerCase();
    return analytics.employees.filter(
      (e) => e.name.toLowerCase().includes(term) || e.email.toLowerCase().includes(term),
    );
  }, [analytics, searchEmployee]);

  // Currently inspected quiz
  const currentQuiz = useMemo(() => {
    if (!analytics || !selectedQuizId) return null;
    return analytics.quizzes.find((q) => q.id === selectedQuizId) || analytics.quizzes[0] || null;
  }, [analytics, selectedQuizId]);

  const tenantName = analytics?.tenant.name || tenants.find((t) => t.id === selectedTenantId)?.name || "Tu Organización";

  return (
    <div className="space-y-8">
      {/* Header with Title and Tenant Switcher */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">
              {isSuperadmin ? "Consola Global · Vista de Organización" : "Portal de Seguridad Corporativa"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {tenantName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Monitoreo en tiempo real del desempeño de colaboradores y puntos críticos de vulnerabilidad.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tenant Switcher for Superadmin */}
          {isSuperadmin && tenants.length > 1 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 shadow-sm">
              <Building2 className="h-4 w-4 text-accent" />
              <label htmlFor="tenant-select" className="sr-only">Seleccionar organización</label>
              <select
                id="tenant-select"
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="bg-transparent text-sm font-semibold text-ink focus:outline-none cursor-pointer"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id} className="bg-surface text-ink">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Badge variant="primary" className="px-3 py-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            {analytics?.summary.totalEmployees ?? 0} Colaboradores
          </Badge>
        </div>
      </header>

      {loading && !analytics ? (
        <div className="py-16 text-center">
          <LoadingState label="Cargando métricas de la organización..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger-readable">
          {error}
        </div>
      ) : analytics ? (
        <>
          {/* Executive Summary StatCards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Índice de Precisión Global"
              value={`${analytics.summary.overallAccuracy}%`}
              hint={analytics.summary.overallAccuracy >= 75 ? "Nivel de resiliencia alto" : "Requiere refuerzo en temas clave"}
              icon={<ShieldCheck className="h-4 w-4" />}
              tone={analytics.summary.overallAccuracy >= 75 ? "success" : analytics.summary.overallAccuracy >= 50 ? "warning" : "danger"}
            />
            <StatCard
              label="Colaboradores Evaluados"
              value={`${analytics.summary.evaluatedEmployees} / ${analytics.summary.totalEmployees}`}
              hint={`${Math.round((analytics.summary.evaluatedEmployees / (analytics.summary.totalEmployees || 1)) * 100)}% de cobertura`}
              icon={<Users className="h-4 w-4" />}
              tone="info"
            />
            <StatCard
              label="Sesiones Realizadas"
              value={String(analytics.summary.totalSessions)}
              hint={`${analytics.summary.totalQuizzes} cuestionarios registrados`}
              icon={<Radio className="h-4 w-4" />}
            />
            <StatCard
              label="Colaboradores en Riesgo"
              value={String(analytics.summary.atRiskCount)}
              hint={analytics.summary.atRiskCount > 0 ? "Tasa de error superior al 40%" : "Sin colaboradores críticos"}
              icon={<ShieldAlert className="h-4 w-4" />}
              tone={analytics.summary.atRiskCount > 0 ? "danger" : "success"}
            />
          </section>

          {/* Quick Action Navigation Strip */}
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface/50 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Radio className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">Evaluaciones en Tiempo Real</p>
                <p className="text-xs text-ink-muted">Inicia una sesión para generar el PIN de acceso inmediato para tus colaboradores.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                to="/live/host"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-[#04211f] shadow-sm transition hover:bg-[var(--color-accent-hover)]"
              >
                <Radio className="h-4 w-4" />
                Lanzar Sesión en Vivo
              </Link>
              <Link
                to="/live/editor"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
              >
                <Pencil className="h-4 w-4" />
                Editor de Quizzes
              </Link>
            </div>
          </section>

          {/* Tab Navigation */}
          <div className="border-b border-border">
            <nav className="flex gap-6" aria-label="Tabs">
              <button
                type="button"
                onClick={() => setActiveTab("collaborators")}
                className={`flex items-center gap-2 border-b-2 py-3 text-sm font-bold transition-colors ${
                  activeTab === "collaborators"
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                <Users className="h-4 w-4" />
                Progreso de Colaboradores
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
                  {analytics.employees.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("quizzes")}
                className={`flex items-center gap-2 border-b-2 py-3 text-sm font-bold transition-colors ${
                  activeTab === "quizzes"
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                Análisis por Quizz & Puntos de Falla
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
                  {analytics.quizzes.length}
                </span>
              </button>
            </nav>
          </div>

          {/* TAB 1: COLLABORATORS DETAILED PROGRESS */}
          {activeTab === "collaborators" && (
            <div className="space-y-6">
              {/* Alert if there are at-risk employees */}
              {analytics.summary.atRiskCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-bold">Colaboradores con alta vulnerabilidad detectados</p>
                    <p className="mt-0.5 text-xs text-amber-200/80">
                      Se identificaron {analytics.summary.atRiskCount} colaboradores con tasa de aciertos inferior al 60% en simulaciones de phishing y autenticación. Se sugiere programar una sesión de refuerzo.
                    </p>
                  </div>
                </div>
              )}

              {/* Search bar & Filter */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
                  <input
                    type="text"
                    value={searchEmployee}
                    onChange={(e) => setSearchEmployee(e.target.value)}
                    placeholder="Buscar por nombre o correo..."
                    className="w-full rounded-xl border border-border bg-surface pl-9 pr-4 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="text-xs text-ink-muted">
                  Mostrando {filteredEmployees.length} de {analytics.employees.length} colaboradores
                </div>
              </div>

              {/* Employees Table */}
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-surface-raised/60 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      <tr>
                        <th className="px-5 py-3.5">Colaborador</th>
                        <th className="px-4 py-3.5 text-center">Evaluaciones</th>
                        <th className="px-4 py-3.5 text-center">Aciertos / Total</th>
                        <th className="px-5 py-3.5">Precisión</th>
                        <th className="px-4 py-3.5 text-center">Puntaje</th>
                        <th className="px-5 py-3.5 text-center">Estado de Seguridad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredEmployees.map((emp) => {
                        const isAtRisk = emp.riskLevel === "Alto";
                        const isTop = emp.status === "Sobresaliente";

                        return (
                          <tr key={emp.userId} className="transition-colors hover:bg-surface-raised/40">
                            {/* Collaborator info */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                                    isAtRisk ? "bg-red-600" : isTop ? "bg-emerald-600" : "bg-sky-600"
                                  }`}
                                >
                                  {emp.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-ink truncate">{emp.name}</p>
                                  <p className="text-xs text-ink-muted truncate font-mono">{emp.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Sessions count */}
                            <td className="px-4 py-4 text-center text-ink-muted">
                              {emp.sessionsCount > 0 ? (
                                <span className="font-medium text-ink">{emp.sessionsCount}</span>
                              ) : (
                                <span className="text-xs text-ink-soft">Pendiente</span>
                              )}
                            </td>

                            {/* Answers breakdown */}
                            <td className="px-4 py-4 text-center">
                              {emp.totalAnswers > 0 ? (
                                <span className="font-mono text-xs font-semibold">
                                  <span className="text-emerald-400">{emp.correctAnswers}</span>
                                  <span className="text-ink-muted"> / </span>
                                  <span>{emp.totalAnswers}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-ink-soft">—</span>
                              )}
                            </td>

                            {/* Accuracy progress bar */}
                            <td className="px-5 py-4 min-w-44">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span
                                    className={
                                      isAtRisk
                                        ? "text-red-400"
                                        : isTop
                                          ? "text-emerald-400"
                                          : "text-amber-400"
                                    }
                                  >
                                    {emp.accuracyRate}%
                                  </span>
                                  <span className="text-[11px] text-ink-muted">
                                    {emp.incorrectAnswers > 0 ? `${emp.incorrectAnswers} fallos` : "Sin fallos"}
                                  </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isAtRisk
                                        ? "bg-red-500"
                                        : isTop
                                          ? "bg-emerald-500"
                                          : "bg-amber-500"
                                    }`}
                                    style={{ width: `${emp.accuracyRate}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="px-4 py-4 text-center font-bold font-mono text-ink">
                              {emp.totalScore > 0 ? `${emp.totalScore} pts` : "—"}
                            </td>

                            {/* Risk / Status Badge */}
                            <td className="px-5 py-4 text-center">
                              {emp.sessionsCount === 0 ? (
                                <span className="inline-flex items-center rounded-full bg-gray-500/15 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                                  Sin evaluar
                                </span>
                              ) : isAtRisk ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Requiere Refuerzo
                                </span>
                              ) : isTop ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Sobresaliente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-400">
                                  <TrendingUp className="h-3.5 w-3.5" />
                                  Aprobado
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED QUIZ & QUESTION BREAKDOWN */}
          {activeTab === "quizzes" && (
            <div className="space-y-6">
              {/* Quiz Picker */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Cuestionario en análisis</p>
                    <label htmlFor="quiz-select" className="sr-only">Seleccionar cuestionario</label>
                    <select
                      id="quiz-select"
                      value={selectedQuizId}
                      onChange={(e) => setSelectedQuizId(e.target.value)}
                      className="mt-0.5 bg-transparent text-base font-bold text-ink focus:outline-none cursor-pointer"
                    >
                      {analytics.quizzes.map((q) => (
                        <option key={q.id} value={q.id} className="bg-surface text-ink">
                          {q.title} ({q.questionCount} preguntas)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {currentQuiz && (
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-ink-muted">Participantes: </span>
                      <strong className="text-ink">{currentQuiz.participantCount}</strong>
                    </div>
                    <div>
                      <span className="text-ink-muted">Precisión promedio: </span>
                      <strong className={currentQuiz.accuracyRate >= 70 ? "text-emerald-400" : "text-amber-400"}>
                        {currentQuiz.accuracyRate}%
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Questions Failure Analysis */}
              {currentQuiz && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-ink">
                      Análisis de Aciertos y Fallos por Pregunta
                    </h3>
                    <span className="text-xs text-ink-muted">
                      Identifica en qué conceptos concretos está tropezando el equipo
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {currentQuiz.questionsBreakdown.map((q, idx) => {
                      const isCriticalFailure = q.accuracyRate < 50;

                      return (
                        <div
                          key={q.questionId}
                          className={`rounded-xl border p-5 transition-all ${
                            isCriticalFailure
                              ? "border-red-500/40 bg-gradient-to-r from-red-950/20 via-surface to-surface"
                              : "border-border bg-surface"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                  isCriticalFailure
                                    ? "bg-red-500 text-white"
                                    : "bg-surface-raised text-ink-muted border border-border"
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div className="space-y-1">
                                <p className="font-semibold text-ink text-sm sm:text-base leading-snug">
                                  {q.text}
                                </p>
                                <span className="inline-block rounded bg-surface-raised px-2 py-0.5 text-[10px] uppercase font-mono text-ink-muted">
                                  {q.type}
                                </span>
                              </div>
                            </div>

                            {/* Stat pill */}
                            <div className="flex items-center gap-2">
                              {isCriticalFailure ? (
                                <Badge variant="danger" className="text-xs">
                                  <AlertTriangle className="h-3 w-3" />
                                  Punto Crítico ({q.failRate}% fallaron)
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {q.accuracyRate}% aciertos
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Progress bar of Team Performance on this question */}
                          <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                            <div className="flex justify-between text-xs">
                              <span className="text-emerald-400 font-medium">
                                {q.correctAttempts} de {q.totalAttempts} colaboradores acertaron
                              </span>
                              <span className="text-red-400 font-medium">
                                {q.totalAttempts - q.correctAttempts} fallaron
                              </span>
                            </div>
                            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-red-950/40">
                              <div
                                className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                                style={{ width: `${q.accuracyRate}%` }}
                              />
                              <div
                                className="h-full bg-red-500 rounded-r-full transition-all duration-500"
                                style={{ width: `${q.failRate}%` }}
                              />
                            </div>
                          </div>

                          {/* Security insight / Explanation */}
                          {q.explanation && (
                            <div className="mt-3 rounded-lg bg-surface-raised/60 p-3 text-xs leading-relaxed text-ink-muted">
                              <strong className="text-accent">Principio de Seguridad: </strong>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
