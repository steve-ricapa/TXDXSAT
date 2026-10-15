import { Link } from "react-router-dom";
import { SystemStatus } from "@/components/SystemStatus";
import { useAuth } from "@/modules/auth/context/AuthContext";

const quickLinks = [
  { to: "/live/host", title: "Lanzar sesión en vivo", body: "Crea un PIN y un QR para tus participantes." },
  { to: "/live/editor", title: "Editor de cuestionarios", body: "Preguntas, imágenes, tiempos y puntajes." },
];

/** Enterprise admin dashboard: quick access to the live-session tooling. */
export function AdminHome() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Hola{user ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Panel de administración de capacitaciones y sesiones en vivo.
        </p>
      </header>

      <SystemStatus />

      <section className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <h2 className="font-semibold">{link.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{link.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
