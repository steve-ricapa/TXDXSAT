import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, QrCode as QrIcon, RefreshCw, UserCheck, UserX } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Field, Input, LoadingState, Select } from "@/components/ui";
import { QrCode } from "@/modules/live-sessions/components/QrCode";
import { tenantsApi, type TenantSummary } from "@/modules/tenants/lib/api";
import { useAuth } from "../context/AuthContext";
import { authApi, type EnrollmentInvite, type EnrollmentUser } from "../lib/api";

export function EnrollmentManagerPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "SUPERADMIN";
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [tenantId, setTenantId] = useState(user?.tenantId ?? "");
  const [invites, setInvites] = useState<EnrollmentInvite[]>([]);
  const [users, setUsers] = useState<EnrollmentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(7);
  const [maxUses, setMaxUses] = useState(100);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [showAllInvites, setShowAllInvites] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ kind: "revoke"; id: string } | { kind: "reject"; user: EnrollmentUser } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperadmin) return;
    tenantsApi.listTenants()
      .then(({ tenants: items }) => { setTenants(items); setTenantId((current) => current || items[0]?.id || ""); })
      .catch(() => setError("No se pudieron cargar las organizaciones."));
  }, [isSuperadmin]);

  const load = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const requested = isSuperadmin ? tenantId : undefined;
      const [inviteResult, userResult] = await Promise.all([authApi.listEnrollmentInvites(requested), authApi.listEnrollmentUsers(requested)]);
      setInvites(inviteResult.invites);
      setUsers(userResult.users);
      setPendingPage((current) => Math.min(current, Math.max(1, Math.ceil(userResult.users.filter((item) => item.enrollmentStatus === "PENDING").length / 8))));
      setUserPage(1);
      setError(null);
    } catch {
      setError("No se pudieron cargar las invitaciones y solicitudes.");
    } finally { setLoading(false); }
  }, [tenantId, isSuperadmin]);

  useEffect(() => { void load(); setNewLink(null); }, [load]);

  async function createInvite() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await authApi.createEnrollmentInvite({ ...(isSuperadmin ? { tenantId } : {}), expiresInDays: days, maxUses });
      const base = new URL(import.meta.env.BASE_URL, window.location.origin);
      setNewLink(new URL(`register/${result.token}`, base).toString());
      setCopied(false);
      setNotice("Invitación creada. Comparte este QR o enlace con tus colaboradores.");
      await load();
    } catch { setError("No se pudo generar la invitación."); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true); setActionError(null);
    try { await authApi.revokeEnrollmentInvite(id); setNewLink(null); setNotice("Enlace desactivado."); setPendingAction(null); await load(); }
    catch { setActionError("No se pudo desactivar el enlace. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(true); setError(null); setActionError(null); setNotice(null);
    try {
      await authApi.decideEnrollment(id, decision);
      setNotice(decision === "approve" ? "Solicitud aprobada. La cuenta ya puede iniciar sesión." : "Solicitud rechazada. La cuenta seguirá sin acceso.");
      setPendingAction(null);
      await load();
    } catch { if (decision === "reject") setActionError("No se pudo rechazar la solicitud. Inténtalo de nuevo."); else setError("No se pudo actualizar la solicitud."); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    if (!newLink) return;
    try { await navigator.clipboard.writeText(newLink); setCopied(true); }
    catch { setError("No se pudo copiar automáticamente. Selecciona el enlace y cópialo."); }
  }

  const pending = users.filter((item) => item.enrollmentStatus === "PENDING");
  const matchingUsers = users.filter((item) => `${item.name} ${item.email}`.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")));
  const visibleUsers = matchingUsers.slice((userPage - 1) * 10, userPage * 10);
  const visiblePending = pending.slice((pendingPage - 1) * 8, pendingPage * 8);
  const selectedName = tenants.find((tenant) => tenant.id === tenantId)?.name;
  return <div className="space-y-6">
    <header><span className="text-xs font-bold uppercase tracking-widest text-accent">Administración</span><h1 className="mt-1 text-3xl font-extrabold text-ink">Invitaciones y registros</h1>
      <p className="mt-2 text-sm text-ink-muted">Comparte un QR para que los colaboradores soliciten acceso. Solo podrán entrar después de tu aprobación.</p>
    </header>
    {isSuperadmin && <Field label="Organización" htmlFor="enrollment-tenant"><Select id="enrollment-tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="max-w-md">
      {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
    </Select></Field>}
    {error && <Alert tone="danger">{error}</Alert>}
    {notice && <Alert tone="success">{notice}</Alert>}
    {!tenantId ? <EmptyState title="No hay una organización seleccionada" description="Selecciona una organización para crear invitaciones." /> : <>
      <Card><CardHeader><CardTitle>Generar QR de registro{selectedName ? ` · ${selectedName}` : ""}</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-ink-muted">El enlace solo crea solicitudes de colaborador para esta organización. Puedes desactivarlo cuando quieras.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Válido por días" htmlFor="invite-days"><Input id="invite-days" type="number" min={1} max={30} value={days} onChange={(event) => setDays(Number(event.target.value))} className="w-32" /></Field>
          <Field label="Máximo de registros" htmlFor="invite-uses"><Input id="invite-uses" type="number" min={1} max={500} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} className="w-40" /></Field>
          <Button variant="accent" onClick={() => void createInvite()} disabled={busy || days < 1 || days > 30 || maxUses < 1 || maxUses > 500} leftIcon={<QrIcon className="h-4 w-4" />}>Generar QR</Button>
        </div>
        {newLink && <div className="flex flex-col items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 p-5 sm:flex-row sm:items-start">
          <QrCode value={newLink} size={188} alt="QR para solicitar registro en la organización" />
          <div className="min-w-0 flex-1 space-y-3"><strong className="text-ink">Invitación lista para compartir</strong><p className="text-xs text-ink-muted">Guarda o comparte el enlace ahora: por seguridad, el código no vuelve a mostrarse después de salir de esta página.</p>
            <Input aria-label="Enlace de registro" readOnly value={newLink} onFocus={(event) => event.currentTarget.select()} />
            <Button variant="outline" onClick={() => void copyLink()} leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{copied ? "Copiado" : "Copiar enlace"}</Button>
          </div>
        </div>}
      </CardContent></Card>

      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-ink">Solicitudes pendientes <Badge variant="accent">{pending.length}</Badge></h2><Button variant="ghost" size="sm" onClick={() => void load()} leftIcon={<RefreshCw className="h-4 w-4" />}>Actualizar</Button></div>
        {loading ? <LoadingState /> : pending.length === 0 ? <EmptyState icon={<UserCheck className="h-5 w-5" />} title="No hay solicitudes pendientes" description="Las nuevas solicitudes aparecerán aquí." /> : <><div className="grid gap-3 md:grid-cols-2">{visiblePending.map((item) => <Card key={item.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-ink">{item.name}</strong><p className="break-all text-sm text-ink-muted">{item.email}</p><p className="mt-1 text-xs text-ink-soft">Solicitó el {new Date(item.createdAt).toLocaleString("es-PE")}</p></div><Badge variant="warning">Pendiente</Badge></div><div className="mt-4 flex gap-2"><Button size="sm" variant="accent" disabled={busy} onClick={() => void decide(item.id, "approve")} leftIcon={<UserCheck className="h-4 w-4" />}>Aprobar</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { setActionError(null); setPendingAction({ kind: "reject", user: item }); }} leftIcon={<UserX className="h-4 w-4" />}>Rechazar</Button></div></Card>)}</div>{pending.length > 8 && <div className="flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={pendingPage <= 1} onClick={() => setPendingPage((page) => page - 1)}>Anterior</Button><span className="text-xs text-ink-muted">{pendingPage} / {Math.ceil(pending.length / 8)}</span><Button size="sm" variant="outline" disabled={pendingPage >= Math.ceil(pending.length / 8)} onClick={() => setPendingPage((page) => page + 1)}>Siguiente</Button></div>}</>}
      </section>

      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold text-ink">Colaboradores de la empresa <Badge variant="accent">{users.length}</Badge></h2><Input aria-label="Buscar colaborador" placeholder="Buscar nombre o correo" value={search} onChange={(event) => { setSearch(event.target.value); setUserPage(1); }} className="w-full sm:w-64" /></div>
        <Card className="divide-y divide-border">{matchingUsers.length === 0 ? <div className="p-5 text-sm text-ink-muted">No hay colaboradores que coincidan.</div> : visibleUsers.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span><strong className="text-ink">{item.name}</strong><span className="ml-2 break-all text-ink-muted">{item.email}</span></span><span className="flex items-center gap-2"><Badge variant={item.enrollmentStatus === "PENDING" ? "warning" : item.isActive ? "success" : "danger"}>{item.enrollmentStatus === "PENDING" ? "Pendiente" : item.enrollmentStatus === "REJECTED" ? "Rechazado" : item.isActive ? "Activo" : "Inactivo"}</Badge>{item.enrollmentStatus === "REJECTED" && <Button variant="outline" size="sm" disabled={busy} onClick={() => void decide(item.id, "approve")}>Aprobar</Button>}</span></div>)}</Card>
        {matchingUsers.length > 10 && <div className="flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={userPage <= 1} onClick={() => setUserPage((page) => page - 1)}>Anterior</Button><span className="text-xs text-ink-muted">{userPage} / {Math.ceil(matchingUsers.length / 10)}</span><Button size="sm" variant="outline" disabled={userPage >= Math.ceil(matchingUsers.length / 10)} onClick={() => setUserPage((page) => page + 1)}>Siguiente</Button></div>}
      </section>

      <section className="space-y-3"><h2 className="text-xl font-bold text-ink">Enlaces generados</h2>
        {invites.length === 0 ? <EmptyState icon={<Link2 className="h-5 w-5" />} title="Aún no hay enlaces" /> : <><div className="grid gap-3 md:grid-cols-2">{(showAllInvites ? invites : invites.slice(0, 6)).map((invite) => <Card key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><strong className="text-ink">{invite.isAvailable ? "Enlace activo" : "Enlace no disponible"}</strong><p className="text-xs text-ink-muted">{invite.uses}/{invite.maxUses} registros · vence {new Date(invite.expiresAt).toLocaleDateString("es-PE")}</p></div>{invite.isAvailable && <Button variant="outline" size="sm" disabled={busy} onClick={() => { setActionError(null); setPendingAction({ kind: "revoke", id: invite.id }); }}>Desactivar</Button>}</Card>)}</div>{invites.length > 6 && <Button variant="ghost" size="sm" onClick={() => setShowAllInvites((value) => !value)}>{showAllInvites ? "Mostrar menos" : `Ver todos (${invites.length})`}</Button>}</>}
      </section>
    </>}
    <Dialog
      open={pendingAction !== null}
      onClose={() => { if (!busy) { setPendingAction(null); setActionError(null); } }}
      title={pendingAction?.kind === "revoke" ? "Desactivar enlace de registro" : "Rechazar solicitud"}
      description={pendingAction?.kind === "revoke" ? "Esta acción impedirá nuevos registros con este QR." : "La cuenta permanecerá sin acceso."}
      footer={<><Button variant="ghost" disabled={busy} onClick={() => { setPendingAction(null); setActionError(null); }}>Cancelar</Button><Button variant="danger" loading={busy} onClick={() => { if (pendingAction?.kind === "revoke") void revoke(pendingAction.id); else if (pendingAction?.kind === "reject") void decide(pendingAction.user.id, "reject"); }}>{pendingAction?.kind === "revoke" ? "Desactivar enlace" : "Rechazar solicitud"}</Button></>}
    >
      <div className="space-y-3 text-sm text-ink-muted">
        {pendingAction?.kind === "revoke" ? <p>Las solicitudes ya enviadas no se perderán y podrás seguir aprobándolas o rechazándolas. Para recibir nuevas solicitudes, tendrás que generar otro enlace.</p> : <p>¿Seguro que quieres rechazar a <strong className="text-ink">{pendingAction?.kind === "reject" ? pendingAction.user.name : ""}</strong>?</p>}
        {actionError && <Alert tone="danger">{actionError}</Alert>}
      </div>
    </Dialog>
  </div>;
}
