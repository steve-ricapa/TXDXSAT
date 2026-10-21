import { useEffect, useState, type ComponentType } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Home,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  QrCode,
  Pencil,
  Radio,
  ShieldCheck,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { BrandLogo, BrandMark } from "@/components/BrandLogo";
import { buttonClass } from "@/components/ui";
import { useAuth } from "@/modules/auth/context/AuthContext";
import type { UserRole } from "@/modules/auth/lib/api";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
  EMPLOYEE: "Colaborador",
};

function buildNavigation(role: UserRole | undefined): NavSection[] {
  const general: NavItem[] = [
    { to: "/", label: "Sitio público", icon: Home, end: true },
    { to: "/employee", label: "Mi capacitación", icon: GraduationCap, end: true },
  ];

  if (role === "EMPLOYEE") {
    general.push({ to: "/employee/history", label: "Historial de sesiones", icon: History });
  }

  const sections: NavSection[] = [{ title: "General", items: general }];

  if (role === "ADMIN" || role === "SUPERADMIN") {
    sections.push({
      title: "Operación",
      items: [
        { to: "/admin", label: "Panel", icon: LayoutDashboard, end: true },
        { to: "/live/host", label: "Sesiones en vivo", icon: Radio },
        { to: "/live/editor", label: "Editor de quizzes", icon: Pencil },
        { to: "/admin/enrollment", label: "Invitaciones y registros", icon: QrCode },
      ],
    });
  }

  if (role === "SUPERADMIN") {
    sections.push({
      title: "Administración",
      items: [
        { to: "/superadmin", label: "Usuarios y Empresas", icon: Users },
      ],
    });
  }

  return sections;
}

/**
 * Corporate application shell shared by every portal: a dark sidebar, a top
 * navbar and a scrollable content area. The live-session module renders its own
 * full-screen layouts outside this shell.
 */
export function AppShell() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const sections = buildNavigation(user?.role);
  const currentLabel =
    sections.flatMap((section) => section.items).find((item) => isActivePath(item, location.pathname))?.label ??
    env.appName;

  async function onLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="app-canvas flex min-h-full">
      {/* Skip link for keyboard users. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#04211f]"
      >
        Saltar al contenido
      </a>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        sections={sections}
        open={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
        onClose={() => setMobileOpen(false)}
        status={status}
        role={user?.role}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="rounded-lg border border-border p-2 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink lg:hidden"
              aria-label="Abrir menú"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <BrandMark size={28} alt="" />
            <h1 className="truncate text-sm font-semibold text-ink sm:text-base">{currentLabel}</h1>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {status === "authenticated" && user ? (
                <>
                  <NavLink
                    to="/account"
                    className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-white/5"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-white">
                      {user.name.slice(0, 1)}
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight text-ink">
                        {user.name}
                      </span>
                      <span className="block text-xs leading-tight text-ink-soft">{ROLE_LABEL[user.role]}</span>
                    </span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className={buttonClass({ variant: "ghost", size: "sm" })}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </>
              ) : (
                <NavLink to="/login" className={buttonClass({ variant: "accent", size: "sm" })}>
                  <LogIn className="h-4 w-4" />
                  Iniciar sesión
                </NavLink>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>

        <footer className="px-4 py-5 text-center text-xs text-ink-soft sm:px-6">
          © {new Date().getFullYear()} TXDXSecure · {env.appName} · Capacitación en ciberseguridad
        </footer>
      </div>
    </div>
  );
}

function isActivePath(item: NavItem, pathname: string): boolean {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function Sidebar({
  sections,
  open,
  status,
  role,
  onNavigate,
  onClose,
}: {
  sections: NavSection[];
  open: boolean;
  status: string;
  role: UserRole | undefined;
  onNavigate: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-[var(--color-surface)] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:self-start lg:z-auto lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex items-center justify-between px-5 py-5">
        <BrandLogo size={40} subtitle="Security Awareness" />
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-soft">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent-soft text-accent"
                          : "text-ink-muted hover:bg-white/5 hover:text-ink",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-accent" : "text-ink-soft")} />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-4">
        {status === "authenticated" && role ? (
          <p className="flex items-center gap-2 text-xs text-ink-soft">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            Sesión {ROLE_LABEL[role].toLowerCase()}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-xs text-ink-soft">
            <UserCircle2 className="h-3.5 w-3.5" />
            Acceso público
          </p>
        )}
      </div>
    </aside>
  );
}
