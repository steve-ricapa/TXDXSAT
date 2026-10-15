import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-6xl font-black text-[var(--color-brand-300)]">404</p>
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <Link to="/" className="text-[var(--color-brand-600)] hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
