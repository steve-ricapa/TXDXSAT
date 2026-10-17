import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Power, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { ApiError } from "@/services/api-client";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Field,
  Input,
  LoadingState,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui";
import { authApi, type AuthUser, type UserRole } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { TenantSummary } from "@/modules/tenants/lib/api";

const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
  EMPLOYEE: "Colaborador",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/**
 * Superadmin console: the single place where administrator accounts are
 * created, activated/deactivated and removed. There is no public registration.
 */
export function UsersPage({ tenants }: { tenants: TenantSummary[] }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("ADMIN");
  const [tenantId, setTenantId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AuthUser | null>(null);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("ADMIN");
  const [editTenantId, setEditTenantId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openEdit(target: AuthUser) {
    setEditing(target);
    setEditName(target.name);
    setEditRole(target.role);
    setEditTenantId(target.tenantId ?? "");
    setEditPassword("");
    setEditError(null);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      await authApi.updateUser(editing.id, {
        name: editName.trim(), role: editRole, tenantId: editTenantId || null,
        ...(editPassword ? { password: editPassword } : {}),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "No se pudo actualizar la cuenta");
    } finally {
      setSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authApi.listUsers();
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await authApi.createUser({ name: name.trim(), email: email.trim(), password, role, tenantId: tenantId.trim() || null });
      setName("");
      setEmail("");
      setPassword("");
      setRole("ADMIN");
      setTenantId("");
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "No se pudo crear el usuario");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(target: AuthUser) {
    try {
      await authApi.updateUser(target.id, { isActive: !target.isActive });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el usuario");
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    try {
      await authApi.deleteUser(target.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el usuario");
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Cuentas de la plataforma</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Solo un superadmin puede crear cuentas. Los colaboradores necesitan el ID de su organización.
          </p>
        </div>
        <Badge variant="accent">{users.length} cuentas</Badge>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            <CardTitle>Crear cuenta</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="new-name" required>
              <Input
                id="new-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ana Pérez"
              />
            </Field>
            <Field label="Correo" htmlFor="new-email" required>
              <Input
                id="new-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ana@empresa.com"
              />
            </Field>
            <Field label="Contraseña" htmlFor="new-password" hint="Mínimo 10 caracteres." required>
              <Input
                id="new-password"
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••"
              />
            </Field>
            <Field label="Rol" htmlFor="new-role" required>
              <Select
                id="new-role"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="ADMIN">Administrador</option>
                <option value="EMPLOYEE">Colaborador</option>
                <option value="SUPERADMIN">Superadmin</option>
              </Select>
            </Field>
            <Field label="Organización" htmlFor="new-tenant" hint={role === "EMPLOYEE" ? "Obligatoria para colaboradores." : "Opcional para cuentas administrativas."}>
              <Select id="new-tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} required={role === "EMPLOYEE"}>
                <option value="">Sin organización</option>
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </Select>
            </Field>

            {createError && (
              <div className="sm:col-span-2">
                <Alert tone="danger">{createError}</Alert>
              </div>
            )}

            <div className="sm:col-span-2">
              <Button type="submit" variant="accent" loading={creating} leftIcon={<UserPlus className="h-4 w-4" />}>
                Crear cuenta
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Cuentas</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        {loading ? (
          <Card>
            <LoadingState label="Cargando usuarios…" />
          </Card>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-5 w-5" />}
            title="Aún no hay cuentas"
            description="Crea el primer administrador con el formulario de arriba."
          />
        ) : (
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Correo</Th>
                  <Th>Rol</Th>
                  <Th>Organización</Th>
                  <Th>Estado</Th>
                  <Th>Último acceso</Th>
                  <Th className="min-w-[300px] border-l border-border bg-white/[0.05] text-right text-accent">Acciones</Th>
                </tr>
              </Thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = item.id === currentUser?.id;
                  return (
                    <Tr key={item.id}>
                      <Td className="font-medium">{item.name}</Td>
                      <Td className="text-ink-muted">{item.email}</Td>
                      <Td>
                        <Badge variant={item.role === "SUPERADMIN" ? "accent" : "neutral"}>
                          {ROLE_LABEL[item.role]}
                        </Badge>
                      </Td>
                      <Td className="text-ink-muted">{tenants.find((tenant) => tenant.id === item.tenantId)?.name ?? (item.tenantId ?? "Plataforma")}</Td>
                      <Td>
                        <Badge variant={item.isActive ? "success" : "danger"}>
                          {item.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </Td>
                      <Td className="text-ink-muted">{formatDate(item.lastLoginAt)}</Td>
                      <Td className="min-w-[300px] border-l border-border bg-surface/40">
                        <div className="flex justify-end gap-1.5 rounded-xl border border-border/80 bg-surface p-1.5 shadow-inner">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(item)}
                            leftIcon={<Pencil className="h-3.5 w-3.5" />}
                            className="border-info/30 bg-info/10 text-info hover:bg-info/15 hover:text-info"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isSelf}
                            onClick={() => void toggleActive(item)}
                            leftIcon={<Power className="h-3.5 w-3.5" />}
                            className="text-amber-300 hover:text-amber-200"
                          >
                            {item.isActive ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf}
                            onClick={() => setPendingDelete(item)}
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                            className="bg-danger/10 text-danger-readable hover:bg-danger/20 hover:text-danger-readable"
                          >
                            Eliminar
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      <Dialog
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title="Editar cuenta"
        footer={<><Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button><Button type="submit" form="edit-user-form" variant="accent" loading={saving}>Guardar</Button></>}
      >
        <form id="edit-user-form" onSubmit={(event) => void saveEdit(event)} className="space-y-4">
          <Field label="Nombre" htmlFor="edit-name" required>
            <Input id="edit-name" required value={editName} onChange={(event) => setEditName(event.target.value)} />
          </Field>
          <Field label="Rol" htmlFor="edit-role">
            <Select id="edit-role" value={editRole} onChange={(event) => setEditRole(event.target.value as UserRole)}>
              <option value="ADMIN">Administrador</option>
              <option value="EMPLOYEE">Colaborador</option>
              <option value="SUPERADMIN">Superadmin</option>
            </Select>
          </Field>
          <Field label="Organización" htmlFor="edit-tenant">
            <Select id="edit-tenant" required={editRole === "EMPLOYEE"} value={editTenantId} onChange={(event) => setEditTenantId(event.target.value)}>
              <option value="">Sin organización</option>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </Select>
          </Field>
          <Field label="Nueva contraseña" htmlFor="edit-password" hint="Deja vacío para conservar la contraseña actual; mínimo 10 caracteres.">
            <Input id="edit-password" type="password" minLength={10} value={editPassword} onChange={(event) => setEditPassword(event.target.value)} />
          </Field>
          {editError && <Alert tone="danger">{editError}</Alert>}
        </form>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Eliminar cuenta"
        description="Esta acción no se puede deshacer."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          ¿Seguro que quieres eliminar la cuenta de{" "}
          <span className="font-semibold text-ink">{pendingDelete?.name}</span>?
        </p>
      </Dialog>
    </div>
  );
}
