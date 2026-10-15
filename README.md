# TXDXSAT

**TXDX Security Awareness Training** — plataforma SaaS multi-tenant de capacitación en
ciberseguridad, desarrollada por **TXDXSecure**.

Despliegue público previsto: `https://txdxsecure.com/sat`.

> **Fase 1 — Inicialización y arquitectura base.** Frontend React/Vite/Tailwind v4,
> backend Express modular con arquitectura Event-Driven (Transactional Outbox),
> PostgreSQL/Prisma e infraestructura Docker de tres contenedores.
>
> **Fase 2 — Motor de sesiones en vivo (quiz en tiempo real).** Integración del motor
> open-source **quizz** (MIT) sobre la arquitectura de TXDXSAT: sockets por sesión, PIN +
> QR, puntuación autoritativa en servidor, persistencia en PostgreSQL y publicación del
> evento de dominio `live_session.finished.v1` vía outbox. Ver
> [`docs/quizz-integration.md`](docs/quizz-integration.md).

---

## Requisitos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | 22 (LTS) | Probado con 24/26 |
| npm | 10 | Usa `package-lock.json` |
| Docker | 24 | Con el plugin `docker compose` (v2) |
| PostgreSQL | 18 | Solo si ejecutas sin Docker |

Las imágenes Docker fijan `node:24-alpine`, `postgres:18-alpine` y `nginx:1.29-alpine`.

---

## Estructura del proyecto

```
TXDXSAT/
├── frontend/                 # React + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── app/              # Router, página raíz, 404
│   │   ├── modules/          # Módulos por funcionalidad (auth, employee, ...)
│   │   ├── components/       # Componentes reutilizables (+ layout/)
│   │   ├── services/         # Cliente HTTP y Socket.IO
│   │   ├── lib/              # Utilidades (env tipado)
│   │   ├── styles/           # Tailwind v4 (CSS-first)
│   │   └── types/
│   ├── Dockerfile            # Multi-stage (deps → dev/builder → Nginx)
│   └── nginx.conf
├── backend/                  # Express + Prisma + Socket.IO
│   ├── src/
│   │   ├── app/              # app.ts, router, CORS, contenedor de dependencias
│   │   ├── modules/          # Módulos (domain/application/infrastructure/presentation)
│   │   ├── events/           # contracts · outbox · publishers · handlers · dispatcher · bus
│   │   ├── realtime/         # Socket.IO
│   │   ├── shared/           # config · database · middleware · errors · utils
│   │   └── server.ts         # Composition root
│   ├── prisma/               # schema.prisma + migraciones
│   └── Dockerfile
├── infrastructure/docker/    # Reservado para artefactos de infraestructura
├── docs/
│   ├── architecture.md       # Arquitectura base (Fase 1)
│   └── quizz-integration.md  # Integración del motor de juego (Fase 2)
├── compose.yaml              # Producción (3 contenedores)
├── compose.dev.yaml          # Desarrollo con hot reload
└── .env.example
```

El módulo de sesiones en vivo vive en:

- Backend: `backend/src/modules/live-sessions/`
  (`domain` · `application` · `infrastructure` · `presentation`).
- Frontend: `frontend/src/modules/live-sessions/`
  (`lib` · `hooks` · `components` · `pages`).

---

## Instalación

```bash
# 1. Variables de entorno
cp .env.example .env
#    Edita POSTGRES_PASSWORD (y ajusta puertos si los necesitas).

# 2. Dependencias
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

> **Nota npm ≥ 11.** Algunos paquetes (Prisma, esbuild) ejecutan scripts de instalación.
> El proyecto los declara en `allowScripts` dentro de `backend/package.json`. Si npm los
> bloquea, ejecuta `npm install-scripts approve prisma @prisma/engines esbuild`.

---

## Variables de entorno

El archivo `.env` (basado en `.env.example`) alimenta Docker Compose. El backend valida
sus variables con Zod al arrancar y falla rápido si falta `DATABASE_URL`.

| Variable | Descripción | Por defecto |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credenciales de PostgreSQL | — |
| `HTTP_PORT` | Puerto público del frontend | `8080` |
| `LOG_LEVEL` | Nivel de log de pino | `info` |
| `CORS_ORIGINS` | Orígenes permitidos separados por coma. Vacío = solo mismo origen en producción | vacío |
| `DISPATCHER_ENABLED` | Activa el dispatcher del outbox | `true` |
| `DISPATCHER_INTERVAL_MS` | Intervalo de sondeo (ms) | `1000` |
| `DISPATCHER_BATCH_SIZE` | Mensajes reclamados por ciclo | `25` |
| `DISPATCHER_MAX_ATTEMPTS` | Reintentos antes del estado terminal `FAILED` | `10` |
| `DISPATCHER_LEASE_MS` | Vigencia del arriendo de un mensaje (ms) | `30000` |
| `RUN_MIGRATIONS` | Ejecuta `prisma migrate deploy` al arrancar el contenedor | `true` |
| `VITE_BASE_PATH` | Prefijo público de despliegue | `/sat/` |

> ⚠️ No se guardan credenciales en el repositorio: `.env` está ignorado por Git.

---

## Comandos de desarrollo

### Con Docker (hot reload)

```bash
docker compose -f compose.dev.yaml up --build
```

- Frontend (Vite + HMR): http://localhost:5173/sat/
- Backend (tsx watch): http://localhost:4000/api/v1/health
- PostgreSQL: `localhost:5433`

### Sin Docker

```bash
# PostgreSQL local + .env con DATABASE_URL apuntando a él
cd backend
npx prisma migrate deploy
npm run prisma:generate
npm run dev            # tsx watch → http://localhost:4000

cd ../frontend
npm run dev            # Vite → http://localhost:5173/sat/
```

Comandos útiles del backend:

```bash
npm run build      # prisma generate + tsc → dist/
npm run start      # node dist/server.js
npm run typecheck  # tsc --noEmit
npm run prisma:studio
```

---

## Despliegue con Docker Compose

```bash
# Producción (tres contenedores: frontend, backend, db)
docker compose up -d --build

# Estado y logs
docker compose ps
docker compose logs -f backend

# Detener / limpiar (conservando el volumen de datos)
docker compose down
docker compose down -v   # ⚠️ elimina también los datos de PostgreSQL
```

Acceso: **http://localhost:8080/sat/**

Topología de red:

- `txdxsat-edge` — publicada; conecta `frontend` ↔ `backend`.
- `txdxsat-data` — **interna**; conecta `backend` ↔ `db`. PostgreSQL no se publica al host.

---

## Migraciones

Prisma 7 usa `prisma.config.ts` (no lee `.env` automáticamente; lo carga con dotenv).

```bash
cd backend
npx prisma migrate dev --name nombre_del_cambio   # desarrollo: crea y aplica
npx prisma migrate deploy                         # producción: solo aplica
npx prisma generate                               # regenera el cliente
```

En Docker, el `ENTRYPOINT` del backend ejecuta `prisma migrate deploy` antes de arrancar
(`RUN_MIGRATIONS=true`).

---

## Sesiones en vivo (Fase 2)

Rutas públicas (SPA a pantalla completa, servidas por Nginx bajo `/sat`):

| Ruta | Pantalla |
|---|---|
| `/sat/live/join` | Jugador: introduce PIN y nombre |
| `/sat/live/play/:sessionId` | Jugador durante la partida |
| `/sat/live/host/:sessionId` | Host: consola de control |
| `/sat/live/present/:sessionId` | Presentador (solo lectura, `viewToken`) |

API REST bajo `/sat/api/v1/live` (`quizzes`, `sessions`, `sessions/:id/results`).
El handshake de Socket.IO se sirve en `/sat/socket.io` (proxy Nginx con upgrade de
WebSocket).

### Scripts de operación

```bash
cd backend

# 1. Cargar el quiz de demostración de ciberseguridad (10 preguntas)
node scripts/seed-demo-quiz.mjs http://localhost:8080/sat/api/v1

# 2. Prueba de humo end-to-end por Socket.IO real
node scripts/smoke-live.mjs http://localhost:8080/sat/api/v1 http://localhost:8080

# 3. Test de carga (jugadores por sesión)
node scripts/load-test.mjs http://localhost:8080/sat/api/v1 http://localhost:8080 /sat/socket.io 20,50,100
```

> En Git Bash de Windows usa `MSYS_NO_PATHCONV=1` para evitar que la ruta
> `/sat/socket.io` se convierta en una ruta de Windows.

---

## Pruebas

Las verificaciones automáticas disponibles en esta fase:

```bash
cd backend  && npm run typecheck && npm run build
cd frontend && npm run typecheck && npm run build
docker compose config            # valida la configuración de Compose
```

Comprobaciones de integración (con la pila levantada):

```bash
curl http://localhost:8080/sat/api/v1/health
# Publica el evento técnico de prueba (publish → outbox → dispatch → consumo)
curl -X POST http://localhost:8080/sat/api/v1/system/test-event \
     -H 'content-type: application/json' -d '{"message":"hola"}'
curl http://localhost:8080/sat/api/v1/system/outbox
```

Prueba de humo del motor en vivo y test de carga: ver
[**Sesiones en vivo (Fase 2)**](#sesiones-en-vivo-fase-2). El detalle de lo
verificado y lo pendiente está en `docs/quizz-integration.md`.

---

## Licencia y atribución

Uso interno de TXDXSecure. El módulo de sesiones en vivo reutiliza componentes del
proyecto open source **quizz** (MIT) — ver `docs/quizz-integration.md`.
