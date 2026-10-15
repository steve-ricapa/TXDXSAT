import { useState, type FormEvent } from "react";
import { ApiError } from "@/services/api-client";
import { authApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

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
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Mi cuenta</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          {user.name} · {user.email} · {user.role === "SUPERADMIN" ? "Superadmin" : "Administrador"}
        </p>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <form onSubmit={onChangePassword} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Contraseña actual</span>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nueva contraseña (mín. 10)</span>
            <input
              type="password"
              required
              minLength={10}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </label>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {message && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-700)] disabled:opacity-50"
          >
            {submitting ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>

      <section className="card flex items-center justify-between p-5">
        <div>
          <h2 className="font-semibold">Sesión</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">Cierra la sesión en este dispositivo.</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-black/5"
        >
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}
