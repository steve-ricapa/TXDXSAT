import { PlaceholderPage } from "@/components/PlaceholderPage";

export function EmployeeHome() {
  return (
    <PlaceholderPage
      portal="empleado"
      title="Mi capacitación"
      description="Aquí el empleado verá sus cursos asignados, evaluaciones pendientes y certificados obtenidos."
    >
      <div className="card p-5 text-sm text-[var(--color-ink-muted)]">
        Placeholder de Fase 1 — el contenido funcional se implementará en fases posteriores.
      </div>
    </PlaceholderPage>
  );
}
