import { PlaceholderPage } from "@/components/PlaceholderPage";

export function AdminHome() {
  return (
    <PlaceholderPage
      portal="empresarial"
      title="Panel de la organización"
      description="Los administradores empresariales gestionarán empleados, campañas de capacitación y reportes de cumplimiento."
    >
      <div className="card p-5 text-sm text-[var(--color-ink-muted)]">
        Placeholder de Fase 1 — el contenido funcional se implementará en fases posteriores.
      </div>
    </PlaceholderPage>
  );
}
