# Arquitectura de TXDXSAT

Este documento describe las decisiones arquitectónicas de la base de la plataforma
(Fase 1) y cómo está preparada para crecer.

---

## 1. Vista general

TXDXSAT es un **monolito modular** desplegado en **tres contenedores**:

```
                 ┌────────────────────────────── txdxsat-edge ──────────────────────────────┐
  Usuario  ──▶   │  frontend (Nginx)  ──/sat/api──▶  backend (Express + Socket.IO)          │
   :8080         │        │                              │                                    │
                 └────────┼──────────────────────────────┼────────────────────────────────────┘
                          │                              │  txdxsat-data (interna)
                          │                              ▼
                          │                      ┌──────────────┐
                          └──/sat/socket.io────▶ │  PostgreSQL  │
                                                 └──────────────┘
```

- **frontend** — React + Vite + Tailwind v4, servido por Nginx bajo `/sat`. Nginx también
  actúa de reverse proxy HTTP y WebSocket.
- **backend** — Express 5, Prisma 7, Socket.IO y el *dispatcher* de eventos. Contiene toda
  la lógica de negocio organizada por módulos.
- **db** — PostgreSQL 18 con volumen persistente, accesible **solo** por la red interna.

No hay Redis, RabbitMQ ni Kafka: la durabilidad de eventos se resuelve con PostgreSQL
(Transactional Outbox). Esto mantiene el consumo de recursos bajo para la EC2 objetivo
(2 vCPU / 4 GB).

---

## 2. Monolito modular

Cada módulo de negocio puede contener cuatro capas, con una única dirección de dependencia
`presentation → application → domain` (infrastructure implementa puertos):

```
modules/<modulo>/
├── domain/          # Entidades y reglas de negocio puras (sin framework)
├── application/     # Casos de uso (orquestan dominio y puertos)
├── infrastructure/  # Adaptadores: persistencia, integraciones
└── presentation/    # Controladores y rutas HTTP
```

Reglas:

- **La lógica de negocio nunca vive en un controlador Express.** El controlador valida la
  entrada (Zod), invoca un caso de uso y serializa la salida.
- **Los módulos no se importan entre sí.** Se comunican por eventos o a través de puertos
  compartidos. La única excepción es el *composition root* (`server.ts`).
- Cada módulo expone una factoría `createXModule(deps)` que recibe sus colaboradores
  inyectados: los módulos no conocen singletons.

Módulos de Fase 1 implementados: `health` y `system`. El resto existen como fronteras
planificadas (marcadores `.gitkeep`).

---

## 3. Comunicación Event-Driven

### 3.1 Contratos de eventos

Los eventos son **versionados** y agnósticos del transporte:

```ts
interface DomainEvent<T> {
  eventId: string;        // UUID; clave de idempotencia
  eventType: string;      // p. ej. "system.test_event.v1"
  version: number;        // deriva del sufijo .vN
  tenantId: string | null;// empresa propietaria (o null = plataforma)
  occurredAt: string;     // ISO-8601
  payload: T;
  correlationId: string;  // agrupa el trabajo de una misma operación
  causationId?: string | null;
}
```

`eventType` sigue la convención `dominio.hecho.vN`. Vocabulario previsto:
`training.assigned.v1`, `training.completed.v1`, `assessment.completed.v1`,
`live_session.finished.v1`, `certificate.issued.v1`, `laboratory.completed.v1`.

### 3.2 Dos mecanismos claramente separados

| | Eventos **de dominio** | Notificaciones **en tiempo real** |
|---|---|---|
| Transporte | Transactional Outbox (PostgreSQL) | Socket.IO |
| Durabilidad | Sí (sobrevive reinicios) | No (efímero) |
| Garantía | Entrega **al menos una vez** | Mejor esfuerzo |
| Uso | Hechos de negocio | Actualizar UI, *broadcasts* |

El **EventBus** en memoria (`events/bus/event-bus.ts`) es *solo* para notificaciones
efímeras (p. ej. reflejar en un socket un evento ya procesado). **Nunca** es el mecanismo de
entrega de un hecho de negocio: se perdería ante un reinicio.

### 3.3 Publicar un evento

```ts
await withTransaction(async (tx) => {
  await repo.createTrainingAssignment(input, tx);          // cambio de negocio
  await publisher.publish(event, { transaction: tx });     // mismo tx → atómico
});
```

El evento se persiste **en la misma transacción** que el cambio de negocio: o se guardan
ambos, o ninguno. Esa es la garantía del patrón Outbox.

---

## 4. Transactional Outbox

**Tabla `outbox_events`.** Campos clave: `event_id` (único), `status`, `attempts`,
`max_attempts`, `available_at` (backoff), `locked_at`/`locked_by` (arriendo),
`last_error`, `dispatched_at`.

### 4.1 Ciclo de vida

```
           publish (misma tx del cambio de negocio)
                       │
                       ▼
   ┌─────────┐  claim  ┌────────────┐  éxito   ┌───────────┐
   │ PENDING │────────▶│ PROCESSING │─────────▶│ PROCESSED │  (terminal)
   └─────────┘         └────────────┘          └───────────┘
        ▲                    │ error
        │  backoff           ▼
        └──────────────  attempts < max_attempts
                             │ attempts ≥ max_attempts
                             ▼
                        ┌────────┐
                        │ FAILED │  (terminal, recuperable)
                        └────────┘
```

### 4.2 Reclamo seguro (sin procesamiento concurrente accidental)

El dispatcher reclama por lote con `FOR UPDATE SKIP LOCKED`:

```sql
UPDATE outbox_events AS o
SET status = 'PROCESSING', locked_at = now(), locked_by = $1,
    attempts = o.attempts + 1, updated_at = now()
WHERE o.id IN (
  SELECT id FROM outbox_events
  WHERE status = 'PENDING' AND available_at <= now()
  ORDER BY available_at, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT $2
)
RETURNING o.*;
```

- El bloqueo es **transaccional**: se libera al confirmar el reclamo.
- `SKIP LOCKED` evita que dos workers tomen el mismo mensaje → se pueden añadir instancias
  del backend sin coordinación adicional.
- Cada mensaje tiene un **arriendo** (`locked_at`). Si un worker muere, otro ejecuta
  `recoverStaleLeases()` y devuelve el mensaje a `PENDING` (o `FAILED` si agotó intentos).

### 4.3 Idempotencia del consumo

**Entrega al menos una vez.** Un fallo entre el commit del handler y el marcado
`PROCESSED` provoca una **reentrega**; por tanto, **los consumidores deben tolerar
duplicados**.

La tabla `event_consumptions` (única por `consumer, event_id`) implementa la protección:
el *marcador* se escribe **en la misma transacción** que los efectos del handler:

```ts
await withTransaction(async (tx) => {
  if (await alreadyConsumed(tx, handler.consumer, event.eventId)) return "duplicate";
  await handler.handle(event, { tx, ... });      // efectos del handler
  await tx.eventConsumption.create({ ... });     // marcador (mismo tx)
});
```

Resultado: **procesamiento efectivamente una vez**, con entrega al menos una vez.

### 4.4 Reintentos y recuperación

- **Backoff exponencial** (base configurable, techo 5 min) vía `available_at`.
- **Estado terminal `FAILED`** al agotar `max_attempts`, conservando `last_error`.
- **Recuperación manual**: `GET /api/v1/system/outbox/failed`,
  `POST /api/v1/system/outbox/:id/requeue`, `POST /api/v1/system/outbox/requeue-failed`.
- Todo ocurre dentro del contenedor backend — **sin un cuarto contenedor**.

---

## 5. Estrategia multi-tenant

Aislamiento **lógico** por empresa (pool compartido), la opción adecuada para el tamaño
objetivo. Convenciones:

- Toda tabla de negocio incluye `tenant_id` (`uuid`), indexado.
- El `tenantId` viaja en el evento y en el contexto de la petición
  (`AsyncLocalStorage`, cabecera `x-tenant-id`).
- El acceso a datos se realiza **siempre** con el `tenantId` resuelto (no confiar en el
  `tenantId` enviado por el cliente; se deriva de la identidad autenticada).
- Preparado para evolucionar a *row-level security* de PostgreSQL o, si se requiere, a
  esquemas/bases por tenant, sin cambiar los contratos de los repositorios.

Las tablas de infraestructura (`outbox_events`, `event_consumptions`) también llevan
`tenant_id` para trazabilidad y filtrado.

---

## 6. Migración futura a AWS Serverless

El diseño aísla el negocio del mecanismo de transporte mediante **puertos**:

| Puerto | Implementación actual | Futuro en AWS |
|---|---|---|
| `EventPublisher` | `OutboxEventPublisher` (PostgreSQL) | Publicar en EventBridge/SQS |
| `EventDispatcher` | `OutboxEventDispatcher` (sondeo) | Long-poll de SQS / invocación Lambda |
| `OutboxStore` | `PrismaOutboxStore` | DynamoDB / propio de SQS |
| `EventHandler` | Handlers en proceso | Handlers Lambda |
| `EventBus` | `EventEmitter` en memoria | API Gateway WebSocket / AppSync |

Camino de migración sugerido:

1. Mantener los contratos `DomainEvent` intactos (viajan en el cuerpo del mensaje).
2. Sustituir el *publisher* por uno que escriba en EventBridge/SQS conservando el Outbox
   como *staging* (patrón *outbox + relay*).
3. Reemplazar el dispatcher por un consumidor de SQS o por Lambdas disparadas por SQS.
4. Como la entrega ya es al menos una vez y los handlers ya son idempotentes, los
   consumidores migran sin cambios de lógica.
5. Las reglas de negocio **no** dependen de Express, Socket.IO, EventBridge ni SQS: solo de
   los puertos y los contratos.

---

## 7. Preparación para el módulo de sesiones en vivo (Fase 2)

- `realtime/socket.ts` ya expone el servidor Socket.IO y el *bridge* de eventos procesados.
- El `EventBus` permite difundir cambios a clientes conectados sin acoplar la lógica.
- El estado operativo de una partida vivirá **en memoria**; PostgreSQL guardará
  quizzes/preguntas/sesiones/resultados, y `live_session.finished.v1` se publicará vía
  Outbox dentro de la transacción que consolide los resultados.
