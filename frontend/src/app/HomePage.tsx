import { Link } from "react-router-dom";
import { ArrowRight, Building2, GraduationCap, Radio, Server, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandLogo";
import { Badge, buttonClass, Card } from "@/components/ui";
import { SystemStatus } from "@/components/SystemStatus";

const portals = [
  {
    to: "/employee",
    title: "Portal del empleado",
    body: "Capacitaciones, evaluaciones y certificados en un solo lugar.",
    icon: GraduationCap,
  },
  {
    to: "/admin",
    title: "Portal empresarial",
    body: "Gestión de la organización y su programa de concientización.",
    icon: Building2,
  },
  {
    to: "/superadmin",
    title: "Portal superadmin",
    body: "Operación de la plataforma SaaS multi-tenant.",
    icon: Server,
  },
];

/** Public landing page: brand hero, portals and the live-session entry point. */
export function HomePage() {
  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-10 sm:px-10 sm:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Badge variant="accent">
              <ShieldCheck className="h-3.5 w-3.5" />
              TXDXSecure · Security Awareness Training
            </Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Capacitación en ciberseguridad, <span className="text-accent">en vivo</span>
            </h1>
            <p className="mt-3 text-base text-ink-muted">
              TXDXSAT es la plataforma SaaS multi-tenant de TXDXSecure para entrenar a las
              organizaciones frente a amenazas reales: formación, gamificación y evaluaciones.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/employee" className={buttonClass({ variant: "accent", size: "lg" })}>
                Empezar capacitación
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/live/join" className={buttonClass({ variant: "outline", size: "lg" })}>
                Unirse con un PIN
              </Link>
            </div>
          </div>
          <BrandMark size={180} className="hidden shrink-0 drop-shadow-2xl lg:block" />
        </div>
      </header>

      <SystemStatus />

      <section className="grid gap-4 sm:grid-cols-3">
        {portals.map((portal) => (
          <Link key={portal.to} to={portal.to} className="group">
            <Card className="h-full p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/50">
              <span className="inline-flex rounded-xl bg-accent-soft p-2.5 text-accent">
                <portal.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-semibold text-ink">{portal.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{portal.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                Entrar
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex rounded-xl bg-primary/25 p-3 text-info">
              <Radio className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">Sesiones en vivo (quiz)</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                Lanza un cuestionario de concienciación en tiempo real: PIN y QR para unirse,
                puntuación instantánea y clasificación en vivo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/live/host" className={buttonClass({ variant: "accent" })}>
              Panel del anfitrión
            </Link>
            <Link to="/live/join" className={buttonClass({ variant: "secondary" })}>
              Unirse con PIN
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
