import { PlaceholderPage } from "@/components/PlaceholderPage";

export function SuperAdminHome() {
  return (
    <PlaceholderPage
      portal="superadmin"
      title="Operación de la plataforma"
      description="El superadministrador supervisará tenants, uso, suscripciones y la salud global de TXDXSAT."
    >
      <div className="card p-5 text-sm text-[var(--color-ink-muted)]">
        Placeholder de Fase 1 — el contenido funcional se implementará en fases posteriores.
      </div>
    </PlaceholderPage>
  );
}
