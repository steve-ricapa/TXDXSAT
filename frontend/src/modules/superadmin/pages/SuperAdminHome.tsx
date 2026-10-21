import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Pencil,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button, Card, LoadingState, StatCard } from "@/components/ui";
import { tenantsApi, type TenantSummary } from "@/modules/tenants/lib/api";
import { liveApi, type QuizSummary, type CreateSessionResult } from "@/modules/live-sessions/lib/api";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { UsersPage } from "@/modules/auth/pages/UsersPage";
import { OrganizationManager } from "../OrganizationManager";

// ─── Launch Modal ────────────────────────────────────────────────────────────

interface LaunchModalProps {
  tenant: TenantSummary;
  onClose: () => void;
}

function LaunchModal({ tenant, onClose }: LaunchModalProps) {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<CreateSessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingQuizzes(true);
    liveApi
      .listQuizzes(tenant.id)
      .then(({ quizzes: q }) => {
        if (!mounted) return;
        setQuizzes(q);
        if (q.length > 0 && q[0]) setSelectedQuizId(q[0].id);
      })
      .catch(() => {
        if (mounted) setError("No se pudieron cargar los quizzes.");
      })
      .finally(() => {
        if (mounted) setLoadingQuizzes(false);
      });
    return () => {
      mounted = false;
    };
  }, [tenant.id]);

  async function handleLaunch() {
    if (!selectedQuizId) return;
    setLaunching(true);
    setError(null);
    try {
      const result = await liveApi.createSession(selectedQuizId, tenant.id);
      setLaunched(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sesión");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Radio className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                Lanzar Sesión en Vivo
              </p>
              <p className="font-bold text-ink">{tenant.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {!launched ? (
            <>
              {loadingQuizzes ? (
                <LoadingState label="Cargando quizzes disponibles..." />
              ) : quizzes.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface-raised/50 p-6 text-center">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-ink-muted" />
                  <p className="font-semibold text-ink">Sin quizzes disponibles</p>
                  <p className="mt-1 text-sm text-ink-muted">Crea un quiz para este tenant primero.</p>
                  <Link
                    to="/live/editor"
                    onClick={onClose}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    <Pencil className="h-4 w-4" />
                    Ir al editor de cuestionarios
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="quiz-select-modal" className="mb-1.5 block text-sm font-semibold text-ink">
                      Selecciona el quiz
                    </label>
                    <select
                      id="quiz-select-modal"
                      value={selectedQuizId}
                      onChange={(e) => setSelectedQuizId(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                    >
                      {quizzes.map((q) => (
                        <option key={q.id} value={q.id} className="bg-surface text-ink">
                          {q.title} ({q.questionCount} preguntas)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl border border-border bg-surface-raised/50 p-4 text-sm text-ink-muted">
                    <p className="font-semibold text-ink">¿Cómo funciona?</p>
                    <p className="mt-1">
                      Al lanzar se generará un <strong className="text-accent">PIN de 6 dígitos</strong>.{" "}
                      Compártelo con los colaboradores de <strong className="text-ink">{tenant.name}</strong> para que se unan desde{" "}
                      <span className="font-mono text-xs bg-surface rounded px-1">/live/join</span>.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger-readable">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={onClose} className="flex-1">
                      Cancelar
                    </Button>
                    <Button
                      variant="accent"
                      onClick={() => void handleLaunch()}
                      loading={launching}
                      leftIcon={<Radio className="h-4 w-4" />}
                      className="flex-1"
                    >
                      Lanzar sesión
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Success state */
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-ink">¡Sesión creada!</p>
                <p className="text-sm text-ink-muted">{launched.quizTitle}</p>
              </div>
              {/* PIN display */}
              <div className="rounded-2xl border-2 border-accent bg-accent/10 py-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">PIN de acceso</p>
                <p className="mt-2 font-mono text-5xl font-extrabold tracking-[0.3em] text-ink">
                  {launched.pin}
                </p>
                <p className="mt-2 text-xs text-ink-muted">
                  Comparte este código con los participantes de {tenant.name}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/live/host/${launched.sessionId}?token=${launched.hostToken}`);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-[#04211f] transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  <Radio className="h-4 w-4" />
                  Abrir consola de host
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Card ─────────────────────────────────────────────────────────────

interface TenantCardProps {
  tenant: TenantSummary;
  onLaunch: (tenant: TenantSummary) => void;
  onViewAdmin: (tenant: TenantSummary) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TenantCard({ tenant, onLaunch, onViewAdmin, onEdit, onDelete }: TenantCardProps) {
  const { stats } = tenant;
  return (
    <Card className="group flex flex-col gap-5 p-5 transition-shadow hover:shadow-lg hover:shadow-black/30">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{tenant.name}</p>
          <p className="text-xs font-mono text-ink-muted">{tenant.slug}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onEdit} className="rounded-md px-2 py-1 text-xs font-semibold text-info hover:bg-info/10">Editar</button>
          <button type="button" onClick={onDelete} className="rounded-md px-2 py-1 text-xs font-semibold text-danger-readable hover:bg-danger/10">Eliminar</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-y border-border py-4">
        <div className="text-center">
          <p className="text-xl font-extrabold tabular-nums text-ink">{stats.employeeCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Colaboradores</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-extrabold tabular-nums text-ink">{stats.quizCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Quizzes</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-extrabold tabular-nums text-ink">{stats.sessionCount}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Sesiones</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onViewAdmin(tenant)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <Shield className="h-3.5 w-3.5" />
          Ver progreso
        </button>
        <button
          type="button"
          onClick={() => onLaunch(tenant)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-[#04211f] transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Zap className="h-3.5 w-3.5" />
          Lanzar quiz
        </button>
      </div>
    </Card>
  );
}

// ─── Main SuperAdminHome ──────────────────────────────────────────────────────

export function SuperAdminHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [activeView, setActiveView] = useState<"tenants" | "users">("tenants");

  const load = () => {
    setLoading(true);
    setError(null);
    tenantsApi
      .listTenants()
      .then(({ tenants: t }) => setTenants(t))
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar organizaciones"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const globalStats = useMemo(() => ({
    totalTenants: tenants.length,
    totalEmployees: tenants.reduce((acc, t) => acc + t.stats.employeeCount, 0),
    totalQuizzes: tenants.reduce((acc, t) => acc + t.stats.quizCount, 0),
    totalSessions: tenants.reduce((acc, t) => acc + t.stats.sessionCount, 0),
  }), [tenants]);

  function handleViewAdmin(tenant: TenantSummary) {
    navigate(`/admin?tenant=${tenant.id}`);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            Consola Global · Superadmin
          </span>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Hola, {user?.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Panel global de organizaciones, quizzes y despliegue de sesiones en vivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
          <Link
            to="/live/editor"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-[#04211f] transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editor de cuestionarios
          </Link>
        </div>
      </header>

      {/* Global StatCards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Organizaciones"
          value={String(globalStats.totalTenants)}
          hint="Tenants activos en la plataforma"
          icon={<Building2 className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="Total Colaboradores"
          value={String(globalStats.totalEmployees)}
          hint="Empleados en todos los tenants"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Quizzes Creados"
          value={String(globalStats.totalQuizzes)}
          hint="Cuestionarios en la plataforma"
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Sesiones Realizadas"
          value={String(globalStats.totalSessions)}
          hint="Sesiones en vivo completadas"
          icon={<Radio className="h-4 w-4" />}
        />
      </section>

      {/* Quick actions strip */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface/50 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">Acciones rápidas de superadmin</p>
            <p className="text-xs text-ink-muted">
              Gestiona cuentas, crea quizzes o lanza sesiones en vivo para cualquier organización.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            <Shield className="h-4 w-4" />
            Vista de Admin
          </Link>
          <Link
            to="/live/host"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            <Radio className="h-4 w-4" />
            Iniciar sesión
          </Link>
          <Link
            to="/live/editor"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-[#04211f] transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Pencil className="h-4 w-4" />
            Crear quiz
          </Link>
        </div>
      </section>

      {/* Tab nav */}
      <div className="border-b border-border">
        <nav className="flex gap-6" aria-label="Superadmin tabs">
          <button
            type="button"
            onClick={() => setActiveView("tenants")}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-bold transition-colors ${
              activeView === "tenants"
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Organizaciones
            <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
              {tenants.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("users")}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-bold transition-colors ${
              activeView === "users"
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Users className="h-4 w-4" />
            Gestión de cuentas
          </button>
        </nav>
      </div>

      {/* Tenants grid */}
      {activeView === "tenants" && (
        <div className="space-y-4">
          <OrganizationManager
            tenants={tenants}
            reload={load}
            loading={loading}
            loadError={error}
            renderTenantCard={(tenant, actions) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  onLaunch={(t) => setSelectedTenant(t)}
                  onViewAdmin={handleViewAdmin}
                  onEdit={actions.onEdit}
                  onDelete={actions.onDelete}
                />
            )}
          />
        </div>
      )}

      {/* Users management */}
      {activeView === "users" && <UsersPage tenants={tenants} />}

      {/* Launch Session Modal */}
      {selectedTenant && (
        <LaunchModal tenant={selectedTenant} onClose={() => setSelectedTenant(null)} />
      )}
    </div>
  );
}
