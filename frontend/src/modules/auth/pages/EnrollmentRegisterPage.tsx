import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandMark } from "@/components/BrandLogo";
import { Alert, Button, Card, Field, Input, LoadingState } from "@/components/ui";
import { ApiError } from "@/services/api-client";
import { authApi } from "../lib/api";

export function EnrollmentRegisterPage() {
  const { token = "" } = useParams();
  const [organization, setOrganization] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;
    authApi.getEnrollmentInvite(token)
      .then((data) => { if (mounted) setOrganization(data.organization); })
      .catch(() => { if (mounted) setError("Este enlace de registro venció o fue desactivado. Solicita uno nuevo a tu administrador."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.registerFromInvite(token, { name: name.trim(), email: email.trim(), password });
      setSubmitted(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError
        ? err.status === 409 ? "Ya existe una cuenta con ese correo." : err.status === 404 ? "Esta invitación ya no está disponible." : err.status === 429 ? "Demasiados intentos. Espera unos minutos." : "Revisa los datos e inténtalo nuevamente."
        : "No se pudo enviar la solicitud. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="app-canvas flex min-h-screen items-center justify-center px-4 py-10">
    <div className="w-full max-w-lg space-y-5">
      <div className="flex items-center justify-center"><BrandMark size={64} /></div>
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold text-ink">Únete a tu organización</h1>
        {loading ? <LoadingState label="Comprobando invitación…" /> : submitted ? <div className="mt-6 space-y-4">
          <Alert tone="success"><strong>Solicitud enviada correctamente.</strong> El administrador de {organization} revisará tu registro. Podrás iniciar sesión cuando lo apruebe.</Alert>
          <Link to="/login" className="text-sm font-semibold text-accent hover:underline">Ir al inicio de sesión</Link>
        </div> : organization ? <>
          <p className="mt-2 text-sm text-ink-muted">Tu cuenta de colaborador pertenecerá a <strong className="text-ink">{organization}</strong>. Quedará pendiente de aprobación; no tendrás acceso hasta que la aprueben.</p>
          <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
            <Field label="Nombre completo" htmlFor="enroll-name" required><Input id="enroll-name" required maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Correo" htmlFor="enroll-email" required><Input id="enroll-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Field label="Contraseña" htmlFor="enroll-password" required hint="Mínimo 10 caracteres."><Input id="enroll-password" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" variant="accent" className="w-full" loading={submitting}>Enviar solicitud de registro</Button>
          </form>
        </> : <Alert tone="danger" className="mt-5">{error}</Alert>}
      </Card>
    </div>
  </div>;
}
