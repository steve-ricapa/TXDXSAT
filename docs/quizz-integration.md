# Integración del motor de juego de `quizz` en TXDXSAT

Documento de la Fase 2: cómo se reutilizó el proyecto open-source **`quizz`**
para construir el motor de sesiones en vivo (quiz en tiempo real estilo Kahoot)
de TXDXSAT, qué se adaptó, qué se dejó fuera y cuáles son las limitaciones
conocidas.

---

## 1. Proyecto de origen y licencia

| Dato | Valor |
| --- | --- |
| Repositorio | <https://github.com/Lawndlwd/quizz> |
| Commit integrado (pineado) | `943b058e1772c1b0d0cc6f239f9dc2924f9cfb60` |
| Licencia | MIT |
| Copyright | Copyright (c) 2026 Lawndlwd |
| Stack original | Monorepo pnpm: `client` (React + Vite + Tailwind + shadcn/ui), `server` (Node + Express + Socket.IO + **SQLite**), datos en `data/config.json` |

### Aviso MIT (obligatorio)

> MIT License
>
> Copyright (c) 2026 Lawndlwd
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

El código derivado de `quizz` dentro de TXDXSAT conserva este aviso. Cualquier
redistribución de TXDXSAT debe mantener este documento (o una nota equivalente)
con el aviso y la atribución anteriores.

---

## 2. Por qué no se ejecutó `quizz` tal cual

El objetivo era **integrar** el motor y la experiencia visual dentro del
monolito modular de TXDXSAT, no desplegar `quizz` como aplicación aparte ni
sustituir la infraestructura de TXDXSAT. Las incompatibilidades que impidieron
una reutilización directa fueron:

1. **Persistencia**: `quizz` usa SQLite y `data/config.json`; TXDXSAT exige
   PostgreSQL + Prisma con aislamiento por `tenantId`. No se permite SQLite.
2. **Topología**: `quizz` se despliega como su propio contenedor/servicio;
   TXDXSAT debe mantener exactamente **tres contenedores**
   (`txdxsat-frontend`, `txdxsat-backend`, `txdxsat-db`). Nada de Redis,
   RabbitMQ ni Kafka.
3. **Autenticación y tenancy**: `quizz` gestiona sus propios usuarios/roles con
   JWT y login; TXDXSAT es multi-tenant con portales `employee/admin/superadmin`
   y aislamiento por tenant.
4. **Modelo de eventos**: TXDXSAT es *event-driven* con **Transactional Outbox**
   en PostgreSQL. La consolidación de resultados de una partida debe publicar el
   evento de dominio `live_session.finished.v1` **en la misma transacción**.
5. **UI/tema**: el `client` de `quizz` está construido sobre shadcn/ui + un
   `tailwind.config.js` clásico. TXDXSAT usa Tailwind v4 (CSS-first,
   `@tailwindcss/vite`) y una identidad corporativa propia.
6. **Alcance**: `quizz` incluye avatares en sistema de ficheros, mapas
   geográficos, gestión de medios, i18n y un estudio de creación de quizzes.
   Todo eso excede el alcance de la Fase 2.

Por todo lo anterior se decidió **portar la lógica pura** (puntuación,
determinismo de barajado, tipos de pregunta, sonidos sintetizados) y
**reimplementar** la capa de UI y de sockets sobre las primitivas de TXDXSAT.

---

## 3. Qué se reutilizó tal cual (lógica portada)

Se copiaron/adaptaron con cambios mínimos los siguientes módulos de lógica pura,
que son la parte más valiosa y validada del proyecto original:

| Origen en `quizz` | Destino en TXDXSAT | Notas |
| --- | --- | --- |
| `server/src/shuffle.ts` (`mulberry32`, `seededPerm`, `seededShuffle`, `invertPerm`) | `backend/src/modules/live-sessions/domain/shuffle.ts` | Portado casi literal. Determinismo de orden de opciones derivado del id de pregunta (`hashSeed(sessionId:questionId)`), de modo que es idéntico en reconexión y re-puntuación sin guardar estado por sesión. |
| `server/src/questionScoring.ts` (`computeSpeedBonus`, normalización `NFKC`) | `backend/src/modules/live-sessions/domain/scoring.ts` (`computeSpeedBonus`, `normalizeText`) | Bono de velocidad **por orden de llegada** (no por tiempo): el primero acierta → `maxBonus`, el último → `minBonus`, interpolado linealmente. |
| `server/src/closestTo.ts` (`closestToDistance`, `closestToMaxDistance`, `scoreClosestToGuess`) | `backend/src/modules/live-sessions/domain/scoring.ts` | Puntuación del tipo `closest_to` reutilizada. `Math.max(...)` del original mapeado a la semántica equivalente (Postgres/JS). |
| `server/src/config.ts` (defaults de juego) | `backend/src/modules/live-sessions/domain/types.ts` | Reglas conservadas: `baseScore = 500`, `speedBonusMax = 200`, `speedBonusMin = 10`, `streakMinimum = 2`, `streakBonusBase = 50`, `questionTimeSec = 20`, `maxPlayersPerSession = 300`. |
| `client/src/lib/sound.ts` (síntesis Web Audio) | `frontend/src/modules/live-sessions/lib/sound.ts` | Síntesis de sonidos por Web Audio (sin ficheros binarios). Se eliminaron "sabores" de tema ajenos a TXDXSAT. |
| `client/src/hooks/useCountdown.ts` (idea) | `frontend/src/modules/live-sessions/hooks/useCountdown.ts` | Reimplementado como hook propio con `endsAt` autoritativo del servidor. |
| `client/src/pages/play/Join.tsx` (idea de UX) | `frontend/src/modules/live-sessions/pages/JoinPage.tsx` | Solo la idea de UX (PIN + nombre); la implementación es nueva. |

**Reglas de puntuación portadas (idénticas al original):**

- Respuesta correcta base: `500`.
- Bono de velocidad por **orden** de respuesta correcta, de `200` (primero) a
  `10` (último), interpolado linealmente según cuántos acertaron antes.
- Bono de racha: activo solo cuando la racha nueva supera `streakMinimum` (es
  decir, estrictamente > 2); aporta `(racha − 2) × 50` **adicionales**.
- Los tipos de crédito parcial (`multi_select`, `open_text` con varios huecos)
  solo conceden bonus cuando el acierto es del 100 %.
- `closest_to`: distancia 0 → correcto (base + bonus); si no, decaimiento
  proporcional `base × (1 − distancia/máx) × 0.75`.

---

## 4. Qué se adaptó

Se tomó la **estructura y el protocolo** de `quizz` y se reescribió la capa de
plataforma para encajarla en TXDXSAT:

### 4.1 Anticheat / orden de guardas al responder

`quizz` aplica una secuencia concreta de comprobaciones antes de aceptar una
respuesta. Se **preservó ese orden** en
`backend/src/modules/live-sessions/application/game-engine.ts`:

1. fase de la partida (debe estar en pregunta abierta),
2. propiedad del socket (`playerForSocket` — la respuesta debe venir del socket
   que posee ese jugador),
3. pregunta actual (`questionId` debe coincidir con la abierta),
4. duplicado (el jugador no puede responder dos veces la misma pregunta),
5. plazo (`questionEndsAt`; si expiró, la respuesta se rechaza/ignora).

El servidor es siempre la autoridad de puntuación, tiempos y respuestas correctas.
El cliente nunca decide aciertos ni puntuación.

### 4.2 Tipos de pregunta

Soportados y probados de extremo a extremo:

- `multiple_choice`
- `true_false`
- `multi_select`
- `open_text`
- `closest_to`

El barajado determinista garantiza que, en reconexión, el jugador ve el **mismo
orden de opciones** aunque el estado en memoria se haya reconstruido: el orden se
deriva del `hashSeed(sessionId:questionId)`, no de un estado mutable.

### 4.3 Codificación de respuestas y `chosen_index`

Se mantiene la idea del original de codificar la elección como *índice en la
posición de visualización* (slot), no como índice original, para que el resaltado
en la pantalla de resultados (`correctDisplayIndices`) coincida con lo que el
jugador vio aunque las opciones estén barajadas.

### 4.4 Avatares

`quizz` guarda avatares en el sistema de ficheros. TXDXSAT los sustituye por un
**catálogo de emojis** en `backend/src/modules/live-sessions/domain/avatars.ts`
(12 entradas, por defecto `shield`), sin dependencias de ficheros ni binarios.

### 4.5 Script de carga

`server/scripts/load-test.mjs` de `quizz` fue la base conceptual del nuevo
`backend/scripts/load-test.mjs`: misma idea (N bots responden a través de
Socket.IO real y se miden percentiles), reescrito para el protocolo de TXDXSAT
(no requiere login admin; crea quiz + sesión por API y usa `host:*`/`player:*`).

### 4.6 UI

Los componentes React de `quizz` **no se copiaron literalmente**. Se
reimplementaron como componentes propios en
`frontend/src/modules/live-sessions/components/` (`Avatar`, `TimerRing`,
`Leaderboard`, `Podium`, `QuestionPanel`, `QuestionStage`, `QrCode`) con el
sistema de diseño de TXDXSAT (Tailwind v4, tema `.live-screen`). El QR se genera
**localmente** con la librería `qrcode` (sin servicios externos), coherente con un
entorno sin salida a Internet.

---

## 5. Qué NO se reutilizó

- Persistencia SQLite y `data/config.json` (sustituidos por Prisma + PostgreSQL).
- Autenticación/login/roles propios de `quizz` (TXDXSAT tiene su propia
  autenticación multi-tenant y portales).
- `GeoMap`, `MediaPicker`, `QuizStudio`, i18n, sistema de avatares en disco,
  panel de administración de usuarios, historial de partidas de `quizz`.
- El frontend shadcn/ui y `tailwind.config.js` clásico.
- El contenedor/Dockerfile/Caddyfile de `quizz`.

---

## 6. Integración de Socket.IO

El transporte en vivo de TXDXSAT corre sobre **Socket.IO 4.8**, en el mismo
proceso `txdxsat-backend` (sin contenedores extra). El handshake se sirve bajo el
prefijo público `/sat` y Nginx lo proxya con upgrade de WebSocket:

```
Navegador  ──ws──▶  Nginx (/sat/socket.io/*)  ──▶  backend:4000 (/socket.io/*)
```

Nginx (`frontend/nginx.conf`) hace el `map $http_upgrade $connection_upgrade` y
reenvía con cabeceras de upgrade; el cliente usa `path: "/sat/socket.io"`.

### 6.1 Separación realtime vs. eventos de dominio

- **Realtime (efímero, Socket.IO)**: estado de la partida en curso, temporizadores,
  conteos, leaderboards. Se modeló reduciendo el conjunto de eventos de `quizz`.
- **Eventos de dominio (durable, Outbox)**: al finalizar la partida, dentro de la
  misma transacción que consolida los resultados, se escribe
  `live_session.finished.v1` en `outbox_events`. El *dispatcher* lo procesa de
  forma asíncrona, idempotente y con reintentos, igual que en la Fase 1. El
  transporte nunca se usa como fuente de verdad de negocio.

### 6.2 Eventos de la sesión en vivo

**Cliente → Servidor**

| Evento | Emisor | Propósito |
| --- | --- | --- |
| `host:join` | host | Autentica al host con `hostToken` y une su socket a la sala. |
| `host:start` | host | Inicia la partida (cuenta atrás → primera pregunta). |
| `host:reveal` | host | Revela la respuesta correcta y la distribución de la pregunta abierta. |
| `host:next` | host | Avanza a la siguiente pregunta o finaliza la partida. Falla con conflicto si la pregunta sigue abierta. |
| `host:end` | host | Termina manualmente la partida. |
| `player:join` | jugador | Se une por PIN con `username` + `avatar`. Renueva conexión si el jugador ya existía. |
| `player:answer` | jugador | Envía la respuesta (`questionId` + `chosenIndex`). |
| `present:join` | presentador | Se une en modo **solo lectura** con `viewToken` (sin privilegios de host). |

**Servidor → Cliente**

| Evento | Propósito |
| --- | --- |
| `session:state` | Estado completo de la sala (jugadores, estado, índice, y `viewToken` solo para el host). |
| `game:started` | La partida arrancó (incluye `countdownSeconds`). |
| `game:countdown` | Tic de cuenta atrás. |
| `game:question` | Pregunta abierta (texto, opciones ya barajadas, `optionOrder`, `endsAt`). |
| `game:answer-count` | Número de respuestas recibidas para la pregunta abierta. |
| `game:results` | Resultados de la pregunta en **espacio de visualización** (`correctDisplayIndices`, `distribution`, `timedOut`). |
| `game:leaderboard` | Clasificación tras la pregunta. |
| `game:player-joined` / `game:player-left` | Entradas/salidas en el *lobby*. |
| `game:ended` | Fin de partida (podio + clasificación final). |
| `player:joined` | Acuse de unión al jugador (incluye `reconnected`). |
| `player:answer-ack` | Acuse de respuesta (correcto/incorrecto, puntuación). |
| `player:error` / `error` | Error dirigido al socket. |

### 6.3 Salas y autorización

- Se usan **rooms por sesión** (`session:<id>`, `host:<id>`, `present:<id>`) y
  emisión dirigida por el puerto `GameBroadcaster`
  (`toSession` / `toHost` / `toPlayer`), de modo que la lógica del motor no
  conoce Socket.IO (se inyecta un `DeferredBroadcaster` al construir el módulo y
  se enlaza con `module.attachRealtime(io)`).
- **Autorización del presentador** por `viewToken` únicamente; nunca por el
  `hostToken`. Los controles de host (start/reveal/next/end) exigen `hostToken`.
  El backend revalida tokens contra el registro en base de datos
  (`loadForHost` / `loadForPresenter`).

---

## 7. Modelo de datos (Prisma)

Añadido en la migración `20261014234723_live_sessions_quiz_engine`. Todas las
tablas llevan `tenantId` para aislamiento multi-tenant.

| Modelo | Campos clave | Notas |
| --- | --- | --- |
| `Quiz` | `id`, `tenantId`, `title`, `description` | Contenedor del quiz. |
| `Question` | `id`, `quizId`, `type`, `text`, `options` (JSON), `correctAnswer` (JSON), `timeSec`, `baseScore`, `imageUrl`, `explanation`, `position` | Tipos: `multiple_choice`, `true_false`, `multi_select`, `open_text`, `closest_to`. |
| `LiveSession` | `id`, `tenantId`, `quizId`, `pin`, `hostToken`, `viewToken`, `status` (`WAITING`/`ACTIVE`/`FINISHED`), `startedAt`, `finishedAt`, `participantCount` | `pin` es de 6 dígitos con CSPRNG; unicidad entre sesiones no terminadas aplicada en la capa de aplicación (`isPinTaken`), no por constraint de BD. |
| `LivePlayer` | `id`, `sessionId`, `username`, `avatar`, `score`, `streak`, `correctAnswers`, `totalAnswers`, `connected` | Nombres de jugador validados; sin duplicados por sesión. |
| `LiveAnswer` | `id`, `playerId`, `questionId`, `payload` (JSON), `isCorrect`, `score`, `answeredAt` | Respuesta única por jugador/pregunta; evita duplicados. |

El payload de resultados consolidado se publica como evento de dominio:

```
live_session.finished.v1
  { sessionId, quizId, participantCount, winner, results[] }
```

con `LiveSessionResultEntry = { playerId, username, avatar, score, correctAnswers, totalAnswers, rank }`.

---

## 8. Arquitectura de sesión

### 8.1 Estado en memoria + snapshots

- El estado **activo** de la partida (pregunta actual, `questionEndsAt`,
  respuestas en curso, sockets) vive en memoria en el proceso backend. Las
  operaciones de partida son de baja latencia y no tocan la BD en cada evento.
- Se persisten **snapshots críticos**: alta de sesión, jugadores, respuestas y
  consolidación final de resultados. Los timestamps de los temporizadores son en
  memoria (ver limitaciones).
- El motor está desacoplado de Prisma mediante el puerto `LiveSessionStore` y de
  Socket.IO mediante `GameBroadcaster`; la implementación de infraestructura es
  sustituible sin tocar el dominio.

### 8.2 Tokens y PIN

- **PIN de 6 dígitos** generado con `node:crypto` (CSPRNG), asignado con un bucle
  de reserva que evita colisiones entre sesiones vivas.
- **`hostToken`** y **`viewToken`** separados: el host controla; el presentador
  solo observa. El `viewToken` solo se entrega al host en `session:state`.
- **Límite de intentos de unión**: por conexión, tras 8 fallos de PIN
  (`player:join` → `NotFoundError`) el socket se desconecta
  (`MAX_JOIN_ATTEMPTS` en `live-session.socket.ts`).

### 8.3 Reconstrucción en frío

Si el proceso se reinicia con una sesión `ACTIVE` en BD, el motor reconstruye el
estado de forma perezosa (`ensureLoaded` + `hydratePlayers`) al primer acceso.
Este comportamiento se documenta como limitación (los temporizadores se
reinician).

---

## 9. Rutas y presentación

Rutas SPA públicas (bajo `/sat`), a pantalla completa, servidas por Nginx con
fallback SPA:

| Ruta | Pantalla |
| --- | --- |
| `/sat/live/join` | El jugador introduce PIN y nombre. |
| `/sat/live/play/:sessionId` | Vista del jugador durante la partida. |
| `/sat/live/host/:sessionId` | Consola del host (control de la partida). |
| `/sat/live/present/:sessionId` | Vista proyectada (presentador, solo lectura). |

API REST bajo `/api/v1/live` (montada por `app/router.ts`):

- `POST /api/v1/live/quizzes` — crear quiz.
- `GET /api/v1/live/quizzes` — listar quizzes.
- `POST /api/v1/live/sessions` — crear sesión (devuelve `sessionId`, `pin`, `hostToken`).
- `GET /api/v1/live/sessions/:id/results` — resultados consolidados (protegido por `viewToken`/`hostToken`).

---

## 10. Cómo se adaptó la persistencia

- **De SQLite a PostgreSQL/Prisma**: las consultas del original se tradujeron a
  Prisma con `tenantId`. La función `MAX(x, y)` de SQLite se sustituyó por su
  equivalente semántico en JS/Postgres.
- **Unicidad de PIN**: en lugar de un constraint único global (que impediría
  reutilizar PINs de partidas terminadas), se valida en aplicación entre
  sesiones no `FINISHED`.
- **Idempotencia del evento de negocio**: el handler
  `live-session-finished.handler.ts` escribe su marca de idempotencia en la misma
  transacción que el procesamiento (tabla `event_consumptions`, única por
  `[consumer, eventId]`), coherente con el resto de la Fase 1.

---

## 11. Verificación realizada (Fase 2)

> Estas comprobaciones **se ejecutaron realmente**, salvo que se indique lo
> contrario.

| Verificación | Comando / método | Resultado |
| --- | --- | --- |
| Typecheck backend | `npx tsc -p tsconfig.json --noEmit` | Limpio |
| Build backend | `npm run build` | Correcto |
| Typecheck frontend | `npx tsc -b --noEmit` | Limpio |
| Build frontend | `npm run build` | Correcto (`dist/index.html`, CSS y JS hasheados) |
| Docker build + up | `docker compose build && docker compose up -d` | 3 contenedores sanos (`frontend`, `backend`, `db`) |
| Migración aplicada | `docker compose logs backend` (entrypoint `prisma migrate deploy`) | `20261014234723_live_sessions_quiz_engine` aplicada |
| Smoke end-to-end (Socket.IO real) | `node scripts/smoke-live.mjs http://localhost:8080/sat/api/v1 http://localhost:8080` | **ALL CHECKS PASSED** (join host/present/player, rechazo de tokens/PIN/nombres duplicados, inicio, rechazo de respuestas prematuras/duplicadas, **plazo de pregunta emitido por el servidor**, **reconexión de jugador conservando identidad y puntuación**, 5 tipos de pregunta puntuados, reveal, avance, fin, leaderboard ordenado, endpoint de resultados 200 con token y 403 sin token, aislamiento de PIN) |
| Rutas `/sat/live/*` | `curl` a `/sat/live/join` y `/sat/live/host` | 200 con la SPA (`<title>TXDXSAT · TXDXSecure</title>`) |
| WebSocket vía Nginx | handshake `/sat/socket.io/?EIO=4&transport=polling` y cliente WS real | Correcto |
| Evento de dominio | `docker compose logs backend` | `live session results consolidated` emitido por cada sesión finalizada (outbox procesado) |
| Test de carga 20/50/100 | `node scripts/load-test.mjs ... 20,50,100` | **0 errores**; 20/20, 50/50 y 100/100 jugadores en el tablero final |

Resultados del test de carga (máquina de desarrollo, ECG objetivo 2 vCPU/4 GB):

```
 20 players · connect 216ms · join 334ms  · avg ack  48ms · errors 0 · finished 20
 50 players · connect 335ms · join 897ms  · avg ack 177ms · errors 0 · finished 50
100 players · connect 762ms · join 2078ms · avg ack 497ms · errors 0 · finished 100
```

Latencia por respuesta (p95): ~99 ms con 20 jugadores, ~344 ms con 50, ~930 ms
con 100. Todos por debajo del plazo de pregunta configurable (30 s en el test).

### Comprobaciones que NO se pudieron ejecutar en esta sesión

- **Cliqueo real en navegador (E2E de UI)**: el entorno de esta sesión no tenía
  navegador conectado (`browser.disconnected`). La UI se validó por typecheck,
  build y revisión de código, más el recorrido funcional vía Socket.IO del smoke
  test; **no** mediante automatización de navegador.
- **Test de carga en 2 vCPU/4 GB reales (EC2 ECG)**: se ejecutó en la máquina de
  desarrollo, no en la instancia objetivo. Los números son orientativos.

---

## 12. Limitaciones conocidas

1. **Reconstrucción en frío y temporizadores**: los timestamps de inicio de
   pregunta (`questionEndsAt`) viven solo en memoria. Si el backend se reinicia
   en mitad de una sesión `ACTIVE`, al reconstruir el estado la pregunta actual
   **reinicia su temporizador**.
2. **Estado activo no replicado**: no hay Redis (excluido en esta fase). El
   estado en vivo no se comparte entre múltiples instancias del backend; la
   topología actual es un único contenedor backend con 3 contenedores en total.
3. **Unicidad de PIN en aplicación**: no existe constraint único de BD sobre
   `LiveSession.pin`; la unicidad se garantiza en código solo entre sesiones no
   terminadas. Un fallo de proceso entre la reserva y el commit podría, en
   teoría, permitir una colisión muy improbable.
4. **Límite de intentos por conexión**: el rate limit de PIN es por socket
   (8 intentos). Un atacante que reconecte obtiene un contador nuevo; con 900 000
   PINs posibles y 6 dígitos se considera aceptable para esta fase.
5. **Sin reconexión con estado en servidor tras caída total**: la reconexión
   normal (mismo jugador, mismo socket namespace) está soportada y no duplica
   jugadores ni puntuaciones; un reinicio del backend en partida es el caso
   límite del punto 1.
6. **Vista de presentador pública con token**: el `viewToken` viaja en la URL de
   la ruta `present`. Quien tenga el enlace puede observar; no puede controlar.
7. **No se portaron**: i18n, mapas geográficos, gestión de medios, estudio de
   creación de quizzes ni el panel de administración de `quizz`.

---

## 13. Archivos de la integración (referencia)

**Backend** (`backend/src/modules/live-sessions/`):

- `domain/`: `scoring.ts`, `shuffle.ts`, `avatars.ts`, `protocol.ts`, `types.ts`
- `application/`: `game-engine.ts`, `ports.ts`, `live-session.usecases.ts`
- `infrastructure/`: `live-session.repository.ts`, `socket-broadcaster.ts`, `live-session-finished.handler.ts`
- `presentation/`: `live-session.routes.ts`, `live-session.socket.ts`
- `live-sessions.module.ts`
- Eventos: `src/events/contracts/event-types.ts` (`live_session.finished.v1`)
- Composición: `src/server.ts` (registro del handler + `attachRealtime`)
- Migración: `prisma/migrations/20261014234723_live_sessions_quiz_engine/`
- Scripts: `scripts/seed-demo-quiz.mjs`, `scripts/smoke-live.mjs`, `scripts/load-test.mjs`

**Frontend** (`frontend/src/modules/live-sessions/`):

- `lib/`: `protocol.ts`, `sound.ts`, `avatars.ts`, `api.ts`, `storage.ts`
- `hooks/`: `useCountdown.ts`, `useSocketEvent.ts`
- `components/`: `Avatar.tsx`, `TimerRing.tsx`, `Leaderboard.tsx`, `Podium.tsx`, `QuestionPanel.tsx`, `QuestionStage.tsx`, `QrCode.tsx`
- `pages/`: `JoinPage.tsx`, `PlayPage.tsx`, `HostPage.tsx`, `PresentPage.tsx`
- Rutas: `src/app/router.tsx`; tema: `src/styles/index.css` (`.live-screen`)

**Infra**: `compose.yaml`, `compose.dev.yaml`, `frontend/nginx.conf` (proxy
`/sat/api` y `/sat/socket.io` con upgrade de WebSocket).

---

## 14. Fase 3 — Experiencia de concurso, imágenes y almacenamiento local

La Fase 3 **no cambia** el motor ni el protocolo de la Fase 2: los cinco tipos de
pregunta, la puntuación autoritativa, el orden de guardas y la sincronización por
Socket.IO se conservan intactos. Lo que se añade es la capa visual tipo concurso,
el editor de preguntas con imágenes y el almacenamiento persistente de medios.

### 14.1 Rediseño visual (estilo concurso, no dashboard)

- Paleta y formas de respuesta: **rojo `#E21B3C`**, **azul `#1368CE`**,
  **amarillo `#D89E00`**, **verde `#26890C`**, cada una con su figura geométrica
  (triángulo, rombo, círculo, cuadrado) — ver
  `frontend/src/modules/live-sessions/lib/answer-style.ts` y `AnswerShape.tsx`.
- **Presentador** (`/live/present/:sessionId`): cabecera con número de pregunta y
  enunciado grande; centro con imagen principal (si la hay), anillo de tiempo
  animado y contador de respuestas; abajo, cuatro tarjetas de respuesta grandes.
  Si no hay imagen, el escenario **se reajusta** automáticamente. Optimizado para
  1920×1080.
- **Jugador** (*mobile-first*): PIN/QR → nombre → lobby → responder → confirmación
  → puntos → posición final. Botones grandes, bloqueo visual tras responder, sin
  scroll.
- **Lobby** (`Lobby.tsx`), **ranking** intermensual (`Leaderboard.tsx`) y **podio**
  final (`Podium.tsx`) con animaciones escalonadas, confeti y fanfarria.
- **Audio** por Web Audio (`lib/sound.ts`): música de lobby/pregunta, cuenta atrás,
  acierto/fallo, ranking y podio; controles de volumen/silencio
  (`SoundControls.tsx`). No se usa música ni arte de Kahoot.

Se eligió **CSS + componentes React** (sin librerías gráficas pesadas) para las
animaciones, manteniendo el rendimiento en proyector.

### 14.2 Editor de preguntas con imágenes

`frontend/src/modules/live-sessions/pages/QuizEditorPage.tsx`, con
`MediaUploader` y `MediaPicker`:

- Enunciado, imagen principal opcional, 2–4 respuestas, imágenes por respuesta
  opcionales, tiempo, puntos, respuesta correcta y explicación.
- Subida por selección o *drag & drop*, vista previa, reemplazo y borrado, y
  **reutilización** de imágenes ya subidas.
- Formatos **JPG/PNG/WebP**, límite inicial **5 MB**, con **optimización en
  cliente** (canvas) antes de subir.

Backend: `POST/PUT /api/v1/live/quizzes/:id` (REST de autoría) y el módulo de
medios (ver §14.3 y [`docs/storage.md`](storage.md)).

### 14.3 Almacenamiento local persistente

- Volumen Docker **`txdxsat_uploads`** montado en `/app/storage`; sobrevive a
  reinicios, reconstrucciones de imagen, `docker compose down` (sin `-v`) y
  actualizaciones de código.
- Estructura `tenants/{tenantId}/{questions,answers,laboratories}` y
  `shared/questions`.
- Puerto desacoplado `FileStorage { upload, get, delete }`; implementación
  **solo** `LocalFileStorage`. La migración a S3 sería únicamente un cambio de
  adaptador.
- La BD guarda solo metadatos (id, tenant, ruta, MIME, tamaño, dimensiones,
  fecha); **nunca** binario ni Base64.
- Seguridad: firma binaria, nombres UUID, prevención de *path traversal*, límite
  de tamaño, autorización por tenant y borrado controlado.

> El detalle completo (interfaz, API, seguridad, persistencia, migración a S3)
> está en **[`docs/storage.md`](storage.md)**.

### 14.4 Demo funcional (phishing)

`scripts/seed-phishing-demo.mjs` sintetiza una captura ficticia de correo de
phishing, la sube por la API de medios (queda en el volumen y en `media_assets`) y
crea un quiz cuya primera pregunta —«¿Cuál de estos correos presenta señales de
phishing?»— usa esa imagen, con la respuesta correcta n.º 2 («Es sospechoso por el
dominio del remitente»). Permite verificar: subida desde el editor, persistencia
en el volumen, referencia en PostgreSQL, imagen mostrada durante el juego,
respuesta, puntuación y supervivencia a un reinicio del backend.

### 14.5 Verificación (Fase 3)

| Verificación | Método | Resultado |
| --- | --- | --- |
| Typecheck/build backend y frontend | `tsc --noEmit`, `npm run build`, `vite build` | Limpios |
| Medios (subida/lectura/aislamiento/borrado) | `node scripts/smoke-media.mjs` | **14/14** |
| Demo de phishing | `node scripts/seed-phishing-demo.mjs` | Imagen + quiz creados |
| Motor en vivo intacto | `node scripts/smoke-live.mjs http://localhost:8080/sat/api/v1` | **ALL CHECKS PASSED** |
| Carga (realtime) | `node scripts/load-test.mjs ... 20` | 0 errores, 20/20 |
| Persistencia del volumen | reinicio + relectura | Ver `docs/storage.md` §4 |

### 14.6 Autenticación (login, sin registro)

La Fase 3 introduce además el **login de administración** (dos roles:
`SUPERADMIN` y `ADMIN`; sin registro público). Los scripts de prueba y operación
ahora se autentican. El detalle está en **[`docs/auth.md`](auth.md)**.

Cambios relevantes para la integración del motor: los endpoints de **autoría**
(`/live/quizzes`, `/media` salvo la lectura por *capability URL*) pasan a exigir
sesión; el juego en vivo (join/play/present por PIN/token) y el endpoint de
resultados por `viewToken`/`hostToken` siguen siendo públicos. El motor y el
protocolo **no** se modificaron.
