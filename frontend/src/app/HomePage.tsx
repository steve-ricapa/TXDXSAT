import { Link } from "react-router-dom";
import { SystemStatus } from "@/components/SystemStatus";

const portals = [
  { to: "/employee", title: "Portal del empleado", body: "Capacitaciones, evaluaciones y certificados." },
  { to: "/admin", title: "Portal empresarial", body: "Gestión de la organización y su programa de concientización." },
  { to: "/superadmin", title: "Portal superadmin", body: "Operación de la plataforma SaaS multi-tenant." },
];

export function HomePage() {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Capacitación en ciberseguridad, <span className="text-[var(--color-brand-600)]">en vivo</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-[var(--color-ink-muted)]">
          TXDXSAT es la plataforma SaaS multi-tenant de TXDXSecure para entrenar a las
          organizaciones frente a amenazas reales.
        </p>
      </header>

      <SystemStatus />

      <section className="grid gap-4 sm:grid-cols-3">
        {portals.map((portal) => (
          <Link
            key={portal.to}
            to={portal.to}
            className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <h2 className="font-semibold">{portal.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{portal.body}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-900)] p-6 text-white">
        <h2 className="text-lg font-bold">Sesiones en vivo (quiz)</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/80">
          Lanza un cuestionario de concienciación en tiempo real: PIN y QR para unirse,
          puntuación instantánea y clasificación en vivo.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/live/host"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[var(--color-brand-700)]"
          >
            Abrir panel del anfitrión
          </Link>
          <Link
            to="/live/join"
            className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30"
          >
            Unirse con un PIN
          </Link>
        </div>
      </section>
    </div>
  );
}
