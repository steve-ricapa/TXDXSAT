import { useState, type FormEvent } from "react";
import { LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { ApiError } from "@/services/api-client";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input } from "@/components/ui";
import { authApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = { SUPERADMIN: "Superadmin", ADMIN: "Administrador", EMPLOYEE: "Colaborador" } as const;

/** Self-service account screen: profile, password change and sign out. */
export function AccountPage() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      // Changing the password revokes all sessions, including this one.
      setMessage("Contraseña actualizada. Vuelve a iniciar sesión.");
      await logout();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Mi cuenta</h1>
        <p className="mt-1 text-sm text-ink-muted">Gestiona tu perfil y tu contraseña.</p>
      </header>

      <Card>
        <CardContent className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold uppercase text-white">
            {user.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-ink">
              {user.name}
              <Badge variant={user.role === "SUPERADMIN" ? "accent" : "neutral"}>
                {ROLE_LABEL[user.role]}
              </Badge>
            </p>
            <p className="truncate text-sm text-ink-muted">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <CardTitle>Cambiar contraseña</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-4">
            <Field label="Contraseña actual" htmlFor="current-password" required>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
            <Field
              label="Nueva contraseña"
              htmlFor="new-password"
              hint="Mínimo 10 caracteres."
              required
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>

            {error && <Alert tone="danger">{error}</Alert>}
            {message && <Alert tone="success">{message}</Alert>}

            <Button type="submit" variant="accent" loading={submitting}>
              Actualizar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <UserCircle2 className="mt-0.5 h-5 w-5 text-ink-soft" />
            <div>
              <h2 className="font-semibold text-ink">Sesión</h2>
              <p className="text-sm text-ink-muted">Cierra la sesión en este dispositivo.</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => void logout()}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
