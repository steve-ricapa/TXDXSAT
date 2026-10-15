import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "@/services/api-client";
import { useAuth } from "../context/AuthContext";

interface LocationState {
  from?: string;
}

/**
 * Login screen. There is deliberately no registration link: accounts are
 * provisioned by a superadmin.
 */
export function LoginPage() {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as LocationState | null)?.from ?? "/admin";

  // Already authenticated: skip the form.
  if (status === "authenticated" && user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-900)] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight">
            TXDX<span className="text-[var(--color-brand-600)]">SAT</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Acceso al panel de administración
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="text-sm font-medium text-[var(--color-ink)]">Correo</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/30"
              placeholder="admin@empresa.com"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--color-ink)]">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/30"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || email.length === 0 || password.length === 0}
            className="w-full rounded-xl bg-[var(--color-brand-600)] py-3 text-sm font-bold text-white transition hover:bg-[var(--color-brand-700)] disabled:opacity-50"
          >
            {submitting ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--color-ink-muted)]">
          Las cuentas son creadas por un superadministrador.{" "}
          <Link to="/" className="underline hover:text-[var(--color-brand-600)]">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
