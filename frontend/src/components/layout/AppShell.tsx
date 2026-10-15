import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { env } from "@/lib/env";
import { useAuth } from "@/modules/auth/context/AuthContext";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

/**
 * Corporate application shell shared by the portals. The live-session module
 * renders its own full-screen layouts outside this shell.
 */
export function AppShell() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  const navigation: NavItem[] = [{ to: "/", label: "Inicio", end: true }];
  if (user) {
    navigation.push({ to: "/admin", label: "Panel" });
    navigation.push({ to: "/live/host", label: "Anfitrión" });
    navigation.push({ to: "/live/editor", label: "Editor" });
  }
  if (user?.role === "SUPERADMIN") {
    navigation.push({ to: "/superadmin", label: "Usuarios" });
  }

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold tracking-tight">
            TXDX<span className="text-[var(--color-brand-600)]">SAT</span>
          </span>
          <nav className="flex flex-1 items-center gap-1 text-sm">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "rounded-md px-3 py-1.5 transition",
                    isActive
                      ? "bg-[var(--color-brand-50)] font-medium text-[var(--color-brand-700)]"
                      : "text-[var(--color-ink-muted)] hover:bg-black/5",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {status === "authenticated" && user ? (
            <div className="flex items-center gap-3">
              <NavLink
                to="/account"
                className="hidden text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] sm:block"
              >
                {user.name}
              </NavLink>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold hover:bg-black/5"
              >
                Salir
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="rounded-lg bg-[var(--color-brand-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-brand-700)]"
            >
              Iniciar sesión
            </NavLink>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-black/5 px-4 py-4 text-center text-xs text-[var(--color-ink-muted)]">
        © {new Date().getFullYear()} TXDXSecure · {env.appName}
      </footer>
    </div>
  );
}
