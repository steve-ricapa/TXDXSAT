import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, UserPlus } from "lucide-react";
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

const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/**
 * Superadmin console: the single place where administrator accounts are
 * created, activated/deactivated and removed. There is no public registration.
 */
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("ADMIN");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AuthUser | null>(null);

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
      await authApi.createUser({ name: name.trim(), email: email.trim(), password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("ADMIN");
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
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Usuarios administradores</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Todas las cuentas son administradores. Solo un superadmin puede crearlas.
          </p>
        </div>
        <Badge variant="accent">{users.length} cuentas</Badge>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            <CardTitle>Crear administrador</CardTitle>
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
                <option value="SUPERADMIN">Superadmin</option>
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
                  <Th>Estado</Th>
                  <Th>Último acceso</Th>
                  <Th className="text-right">Acciones</Th>
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
                      <Td>
                        <Badge variant={item.isActive ? "success" : "danger"}>
                          {item.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </Td>
                      <Td className="text-ink-muted">{formatDate(item.lastLoginAt)}</Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf}
                            onClick={() => void toggleActive(item)}
                          >
                            {item.isActive ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf}
                            onClick={() => setPendingDelete(item)}
                            className="text-danger-readable hover:bg-danger/10 hover:text-danger-readable"
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
