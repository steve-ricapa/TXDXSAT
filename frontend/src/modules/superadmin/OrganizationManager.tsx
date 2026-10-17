import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Dialog, Field, Input, LoadingState } from "@/components/ui";
import { tenantsApi, type TenantSummary } from "@/modules/tenants/lib/api";

interface OrganizationActions {
  onEdit: () => void;
  onDelete: () => void;
}

export function OrganizationManager({
  tenants,
  reload,
  loading,
  loadError,
  renderTenantCard,
}: {
  tenants: TenantSummary[];
  reload: () => void;
  loading: boolean;
  loadError: string | null;
  renderTenantCard: (tenant: TenantSummary, actions: OrganizationActions) => ReactNode;
}) {
  const [editing, setEditing] = useState<TenantSummary | "new" | null>(null);
  const [deleting, setDeleting] = useState<TenantSummary | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open(tenant: TenantSummary | "new") {
    setName(tenant === "new" ? "" : tenant.name);
    setSlug(tenant === "new" ? "" : tenant.slug);
    setError(null);
    setEditing(tenant);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const input = { name: name.trim(), slug: slug.trim().toLowerCase() };
      if (editing === "new") await tenantsApi.createTenant(input);
      else await tenantsApi.updateTenant(editing.id, input);
      setEditing(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la organización");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await tenantsApi.deleteTenant(deleting.id);
      setDeleting(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la organización");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">Crea organizaciones antes de asignarles cuentas.</p>
        <Button variant="accent" onClick={() => open("new")}>Crear organización</Button>
      </div>
      <Dialog open={editing !== null} onClose={() => !busy && setEditing(null)} title={editing === "new" ? "Crear organización" : "Editar organización"}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancelar</Button><Button type="submit" form="organization-form" variant="accent" loading={busy}>Guardar</Button></>}>
        <form id="organization-form" onSubmit={(event) => void save(event)} className="space-y-4">
          <Field label="Nombre" htmlFor="organization-name" required>
            <Input id="organization-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Identificador (slug)" htmlFor="organization-slug" hint="Letras minúsculas, números y guiones; debe ser único." required>
            <Input id="organization-slug" required minLength={2} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      </Dialog>
      <Dialog open={deleting !== null} onClose={() => !busy && setDeleting(null)} title="Eliminar organización"
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>Cancelar</Button><Button variant="danger" loading={busy} onClick={() => void remove()}>Eliminar</Button></>}>
        <p className="text-sm text-ink-muted">¿Eliminar {deleting?.name}? Solo se pueden eliminar organizaciones sin datos asociados.</p>
        {error && <Alert tone="danger">{error}</Alert>}
      </Dialog>
      {loading ? (
        <div className="py-16 text-center"><LoadingState label="Cargando organizaciones..." /></div>
      ) : loadError ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger-readable">{loadError}</div>
      ) : tenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-ink-muted">
          <p className="font-semibold">Sin organizaciones</p>
          <p className="mt-1 text-sm">No hay tenants registrados aún.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => renderTenantCard(tenant, {
            onEdit: () => open(tenant),
            onDelete: () => { setError(null); setDeleting(tenant); },
          }))}
        </div>
      )}
    </>
  );
}
