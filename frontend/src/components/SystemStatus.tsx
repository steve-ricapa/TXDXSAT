import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import type { HealthReport } from "@/services/system";
import { systemApi } from "@/services/system";
import { Alert, Badge, Button, Card, Spinner } from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";

type LoadState = "loading" | "ready" | "error";

/** Map a health check value onto a badge tone without assuming an exact enum. */
function toneFor(value: string): BadgeVariant {
  const normalized = value.toLowerCase();
  if (normalized.includes("ok") || normalized.includes("up") || normalized.includes("run")) return "success";
  if (normalized.includes("degrad") || normalized.includes("warn")) return "warning";
  if (normalized.includes("down") || normalized.includes("error") || normalized.includes("fail")) return "danger";
  return "neutral";
}

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
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          <Activity className="h-4 w-4 text-accent" />
          Estado del sistema
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onPublish()}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Publicar evento de prueba
        </Button>
      </div>

      {state === "loading" && (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Spinner className="h-4 w-4" /> Consultando…
        </p>
      )}

      {state === "error" && (
        <Alert tone="danger">No se pudo contactar la API: {error}</Alert>
      )}

      {state === "ready" && health && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
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
        <p className="mt-4 text-xs text-success">
          Evento publicado: <code className="rounded bg-white/5 px-1.5 py-0.5">{lastEventId}</code>
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-1">
        <Badge variant={toneFor(value)}>{value}</Badge>
      </dd>
    </div>
  );
}
