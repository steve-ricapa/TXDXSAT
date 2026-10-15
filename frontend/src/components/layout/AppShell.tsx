import { NavLink, Outlet } from "react-router-dom";
import { env } from "@/lib/env";

const navigation = [
  { to: "/", label: "Inicio", end: true },
  { to: "/employee", label: "Empleado" },
  { to: "/admin", label: "Administrador" },
  { to: "/superadmin", label: "Superadmin" },
];

/**
 * Corporate application shell shared by the three portals. The live-session
 * module renders its own full-screen layouts outside this shell.
 */
export function AppShell() {
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
          <span className="hidden text-xs text-[var(--color-ink-muted)] sm:block">
            {env.appName}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-black/5 px-4 py-4 text-center text-xs text-[var(--color-ink-muted)]">
        © {new Date().getFullYear()} TXDXSecure · TXDXSAT
      </footer>
    </div>
  );
}
