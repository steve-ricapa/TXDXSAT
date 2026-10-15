import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api-client";
import { authApi, type AuthUser, type UserRole } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/**
 * Superadmin console: the single place where administrator accounts are
 * created, activated/deactivated and removed. There is no public registration.
 */
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("ADMIN");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authApi.listUsers();
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await authApi.createUser({ name: name.trim(), email: email.trim(), password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("ADMIN");
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "No se pudo crear el usuario");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(target: AuthUser) {
    try {
      await authApi.updateUser(target.id, { isActive: !target.isActive });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el usuario");
    }
  }

  async function remove(target: AuthUser) {
    if (!window.confirm(`¿Eliminar la cuenta de ${target.name}?`)) return;
    try {
      await authApi.deleteUser(target.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el usuario");
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Usuarios administradores</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Todas las cuentas son administradores. Solo un superadmin puede crearlas.
        </p>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold">Crear administrador</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Nombre</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="Ana Pérez"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Correo</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="ana@empresa.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Contraseña (mín. 10)</span>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
              placeholder="••••••••••"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Rol</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <option value="ADMIN">Administrador</option>
              <option value="SUPERADMIN">Superadmin</option>
            </select>
          </label>

          {createError && (
            <p className="sm:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {createError}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-700)] disabled:opacity-50"
            >
              {creating ? "Creando…" : "Crear cuenta"}
            </button>
          </div>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
          <h2 className="font-semibold">Cuentas ({users.length})</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-brand-600)] hover:bg-black/5"
          >
            Actualizar
          </button>
        </div>

        {error && <p className="px-5 py-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <p className="px-5 py-6 text-sm text-[var(--color-ink-muted)]">Cargando…</p>
        ) : users.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-ink-muted)]">Aún no hay cuentas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-5 py-2 font-semibold">Nombre</th>
                  <th className="px-5 py-2 font-semibold">Correo</th>
                  <th className="px-5 py-2 font-semibold">Rol</th>
                  <th className="px-5 py-2 font-semibold">Estado</th>
                  <th className="px-5 py-2 font-semibold">Último acceso</th>
                  <th className="px-5 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = item.id === currentUser?.id;
                  return (
                    <tr key={item.id} className="border-t border-black/5">
                      <td className="px-5 py-3 font-medium">{item.name}</td>
                      <td className="px-5 py-3 text-[var(--color-ink-muted)]">{item.email}</td>
                      <td className="px-5 py-3">{ROLE_LABEL[item.role]}</td>
                      <td className="px-5 py-3">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            item.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-700",
                          ].join(" ")}
                        >
                          {item.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-ink-muted)]">
                        {formatDate(item.lastLoginAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => void toggleActive(item)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-700)] hover:bg-black/5 disabled:opacity-40"
                          >
                            {item.isActive ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => void remove(item)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
