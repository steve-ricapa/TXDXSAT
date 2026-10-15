import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="inline-flex rounded-2xl bg-accent-soft p-4 text-accent">
        <Compass className="h-8 w-8" />
      </span>
      <p className="text-5xl font-black tracking-tight text-accent">404</p>
      <h1 className="text-xl font-semibold text-ink">Página no encontrada</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        La dirección que buscas no existe o fue movida.
      </p>
      <Link to="/" className={buttonClass({ variant: "accent" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
