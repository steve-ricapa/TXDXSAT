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
>
> **Fase 3 — Experiencia tipo concurso, imágenes y almacenamiento local.** Rediseño
> visual del presentador/jugador (colores y formas de concurso, animaciones, audio,
> lobby, ranking y podio), **editor de preguntas con imágenes** y **almacenamiento local
> persistente** en un volumen Docker (sin S3). Ver
> [`docs/storage.md`](docs/storage.md) y
> [`docs/quizz-integration.md`](docs/quizz-integration.md).
>
> **Autenticación — solo login (sin registro).** Dos roles, `SUPERADMIN` y `ADMIN`; todas
> las cuentas las crea un superadmin. Sesiones opacas de servidor. Ver
> [`docs/auth.md`](docs/auth.md).

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
│   ├── quizz-integration.md  # Integración del motor de juego (Fase 2 y 3)
│   ├── storage.md            # Almacenamiento local de imágenes (Fase 3)
│   └── auth.md               # Autenticación y usuarios (login, sin registro)
├── compose.yaml              # Producción (3 contenedores)
├── compose.dev.yaml          # Desarrollo con hot reload
└── .env.example
```

El módulo de sesiones en vivo vive en:

- Backend: `backend/src/modules/live-sessions/`
  (`domain` · `application` · `infrastructure` · `presentation`).
- Frontend: `frontend/src/modules/live-sessions/`
  (`lib` · `hooks` · `components` · `pages`).

Otros módulos:

- **Autenticación** (`backend/src/modules/auth/`, `frontend/src/modules/auth/`):
  login, sesiones opacas y gestión de usuarios.
- **Medios** (`backend/src/modules/media/`): puerto `FileStorage` +
  `LocalFileStorage`, subida/lectura/borrado de imágenes.

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
| `STORAGE_DRIVER` | Adaptador de almacenamiento de imágenes (`local`) | `local` |
| `STORAGE_DIR` | Directorio de almacenamiento (debe ser el volumen `txdxsat_uploads`) | `/app/storage` |
| `STORAGE_MAX_BYTES` | Tamaño máximo por imagen, en bytes | `5242880` (5 MB) |
| `SESSION_TTL_HOURS` | Caducidad de las sesiones de login (horas) | `720` |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME` | Superadmin inicial (solo se crea si no hay cuentas) | — |
| `SEED_DEMO_DATA` | Crea tenants, cuentas y datos de demo; desactivado por defecto (se activa en `compose.dev.yaml`) | `false` |
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

## Autenticación (login, sin registro)

La plataforma es **solo login**: no hay registro público. Todas las cuentas las
crea un **SUPERADMIN**; los usuarios creados son **ADMIN**. El primer superadmin
se crea automáticamente al arrancar si no existe ninguna cuenta
(`SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME`), o manualmente:

```bash
cd backend
npm run seed:superadmin
```

| Ruta | Acceso |
|---|---|
| `/sat/login` | Público |
| `/sat/admin`, `/sat/live/host/:id`, `/sat/live/editor` | Requiere sesión |
| `/sat/superadmin`, `/sat/account` | Requiere sesión (superadmin / cuenta) |
| `/sat/live/join`, `/sat/live/play/:id`, `/sat/live/present/:id` | Público (PIN/token) |

El token de sesión (opaco, tipo portador) se envía como `Authorization: Bearer`.
El detalle del modelo, roles, endpoints y CORS está en
[`docs/auth.md`](docs/auth.md).

> ⚠️ Cambia `SUPERADMIN_PASSWORD` (y `POSTGRES_PASSWORD`) antes de exponer el
> servicio.

---

## Sesiones en vivo (Fase 2 y 3)

Rutas SPA (a pantalla completa, servidas por Nginx bajo `/sat`):

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/sat/live/join` | Jugador: introduce PIN y nombre | Público |
| `/sat/live/play/:sessionId` | Jugador durante la partida | Público |
| `/sat/live/present/:sessionId` | Presentador (solo lectura, `viewToken`) | Público |
| `/sat/live/host/:sessionId` | Host: consola de control | Sesión |
| `/sat/live/editor` | Editor de quizzes con imágenes | Sesión |

API REST bajo `/sat/api/v1/live` (`quizzes`, `sessions`, `sessions/:id/results`)
y `/sat/api/v1/media` (subida/lectura/borrado de imágenes). El handshake de
Socket.IO se sirve en `/sat/socket.io` (proxy Nginx con upgrade de WebSocket).

### Scripts de operación

Los scripts de autoría/medios requieren sesión: toman las credenciales de
`SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (o de `TXDXSAT_TOKEN`).

```bash
cd backend

# 0. Autenticación: prueba de login, roles, endpoints y CORS (40 checks)
node scripts/smoke-auth.mjs http://localhost:8080/sat/api/v1

# 1. Cargar el quiz de demostración de ciberseguridad
node scripts/seed-demo-quiz.mjs http://localhost:8080/sat/api/v1

# 2. Demo de phishing con imagen (sube la imagen y crea el quiz)
node scripts/seed-phishing-demo.mjs http://localhost:8080/sat/api/v1

# 3. Medios: subida, lectura, aislamiento entre tenants y borrado (14 checks)
node scripts/smoke-media.mjs http://localhost:8080/sat/api/v1

# 4. Prueba de humo end-to-end por Socket.IO real
node scripts/smoke-live.mjs http://localhost:8080/sat/api/v1 http://localhost:8080

# 5. Test de carga (jugadores por sesión)
node scripts/load-test.mjs http://localhost:8080/sat/api/v1 http://localhost:8080 /sat/socket.io 20,50,100
```

> En Git Bash de Windows usa `MSYS_NO_PATHCONV=1` para evitar que la ruta
> `/sat/socket.io` se convierta en una ruta de Windows.

### Almacenamiento de imágenes (Fase 3)

Las imágenes se guardan en el volumen Docker **`txdxsat_uploads`** (montado en
`/app/storage`), fuera de directorios públicos, y se sirven por endpoints
controlados con *capability URLs* (UUID). Persisten a reinicios, reconstrucciones
y `docker compose down` (sin `-v`). Detalle en [`docs/storage.md`](docs/storage.md).

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
[**Sesiones en vivo (Fase 2 y 3)**](#sesiones-en-vivo-fase-2-y-3). El detalle de
lo verificado y lo pendiente está en `docs/quizz-integration.md`,
`docs/storage.md` y `docs/auth.md`.

---

## Licencia y atribución

Uso interno de TXDXSecure. El módulo de sesiones en vivo reutiliza componentes del
proyecto open source **quizz** (MIT) — ver `docs/quizz-integration.md`.
