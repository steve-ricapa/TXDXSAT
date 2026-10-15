import { Link } from "react-router-dom";
import { ArrowRight, Building2, Pencil, Radio, Users } from "lucide-react";
import { Badge, Card, StatCard } from "@/components/ui";
import { SystemStatus } from "@/components/SystemStatus";
import { useAuth } from "@/modules/auth/context/AuthContext";

const quickLinks = [
  {
    to: "/live/host",
    title: "Lanzar sesión en vivo",
    body: "Crea un PIN y un QR para tus participantes.",
    icon: Radio,
  },
  {
    to: "/live/editor",
    title: "Editor de cuestionarios",
    body: "Preguntas, imágenes, tiempos y puntajes.",
    icon: Pencil,
  },
];

/** Enterprise admin dashboard: quick access to the live-session tooling. */
export function AdminHome() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Portal empresarial
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Hola{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Panel de administración de capacitaciones y sesiones en vivo.
          </p>
        </div>
        <Badge variant="primary">
          <Building2 className="h-3.5 w-3.5" />
          Organización
        </Badge>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sesiones en vivo" value="—" hint="Sin datos aún" icon={<Radio className="h-4 w-4" />} />
        <StatCard label="Cuestionarios" value="—" hint="Edita tus quizzes" icon={<Pencil className="h-4 w-4" />} tone="info" />
        <StatCard label="Participantes" value="—" hint="Histórico por sesión" icon={<Users className="h-4 w-4" />} tone="success" />
      </section>

      <SystemStatus />

      <section className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to} className="group">
            <Card className="flex h-full items-start gap-4 p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent/50">
              <span className="inline-flex rounded-xl bg-accent-soft p-3 text-accent">
                <link.icon className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-ink">{link.title}</h2>
                <p className="mt-1 text-sm text-ink-muted">{link.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                  Abrir
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
