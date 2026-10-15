import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { ApiError } from "@/services/api-client";
import { BrandMark } from "@/components/BrandLogo";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
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
    <div className="app-canvas flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={96} className="drop-shadow-xl" />
          <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">
            TXDX<span className="text-accent">SAT</span>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Acceso al panel de administración</p>
        </div>

        <Card className="p-7">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Correo" htmlFor="login-email" required>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-10"
                  placeholder="admin@empresa.com"
                />
              </div>
            </Field>

            <Field label="Contraseña" htmlFor="login-password" required>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-10"
                  placeholder="••••••••"
                />
              </div>
            </Field>

            {error && <Alert tone="danger">{error}</Alert>}

            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full"
              loading={submitting}
              disabled={email.length === 0 || password.length === 0}
            >
              Iniciar sesión
            </Button>
          </form>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          Las cuentas son creadas por un superadministrador.{" "}
          <Link to="/" className="font-medium text-accent hover:underline">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
