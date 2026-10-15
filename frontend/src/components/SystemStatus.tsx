import { useCallback, useEffect, useState } from "react";
import type { HealthReport } from "@/services/system";
import { systemApi } from "@/services/system";

type LoadState = "loading" | "ready" | "error";

/**
 * Verifies — from the browser — that the versioned API is reachable under the
 * `/sat` prefix, the database is up and the event dispatcher is running. Also
 * triggers the technical smoke-test event so the publish→outbox→dispatch path can
 * be observed end to end.
 */
export function SystemStatus() {
  const [state, setState] = useState<LoadState>("loading");
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const report = await systemApi.getHealth();
      setHealth(report);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const onPublish = useCallback(async () => {
    setLastEventId(null);
    try {
      const result = await systemApi.publishTestEvent("smoke test from UI");
      setLastEventId(result.eventId);
      setTimeout(() => void load(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [load]);

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Estado del sistema
        </h2>
        <button
          type="button"
          onClick={() => void onPublish()}
          className="rounded-md bg-[var(--color-brand-600)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-700)]"
        >
          Publicar evento de prueba
        </button>
      </div>

      {state === "loading" && <p className="text-sm text-[var(--color-ink-muted)]">Consultando…</p>}

      {state === "error" && (
        <p className="text-sm text-red-600">No se pudo contactar la API: {error}</p>
      )}

      {state === "ready" && health && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Servicio" value={health.status} />
          <Stat label="Base de datos" value={health.checks.database} />
          <Stat label="Dispatcher" value={health.checks.dispatcher} />
          <Stat label="Versión" value={health.version} />
          {health.outbox && (
            <>
              <Stat label="Pendientes" value={String(health.outbox.pending)} />
              <Stat label="Procesados" value={String(health.outbox.processed)} />
              <Stat label="Fallidos" value={String(health.outbox.failed)} />
              <Stat label="Uptime" value={`${health.uptimeSeconds}s`} />
            </>
          )}
        </dl>
      )}

      {lastEventId && (
        <p className="mt-3 text-xs text-emerald-600">
          Evento publicado: <code>{lastEventId}</code>
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
