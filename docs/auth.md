# Autenticación y usuarios

Documento del subsistema de autenticación de TXDXSAT: **solo login** (no hay
registro público), dos roles (`SUPERADMIN` y `ADMIN`) y sesiones opacas de
servidor.

---

## 1. Modelo

- **No existe registro público.** `POST /api/v1/auth/register` devuelve **404** a
  propósito. Todas las cuentas las crea un **SUPERADMIN**.
- Roles (`UserRole`):
  - **`SUPERADMIN`**: gestiona usuarios (crear/listar/editar/desactivar/borrar),
    crea cuestionarios y sesiones, y consulta métricas de cualquier organización.
  - **`ADMIN`**: consulta las métricas de su propia organización. No puede
    consultar datos de otras empresas ni crear cuestionarios o sesiones.
- Multi-tenant: `User.tenantId` es opcional (`null` = ámbito/plataforma
  compartida). Un ADMIN pertenece a su tenant; sus activos de medios quedan
  acotados a ese tenant.

---

## 2. Sesiones opacas (no JWT)

Al hacer login se emite un **token opaco de 256 bits** (CSPRNG). El cliente lo
guarda y lo envía como `Authorization: Bearer <token>`.

- El servidor **solo guarda el hash SHA-256** del token (`Session.tokenHash`),
  nunca el token en claro.
- La comparación usa `timingSafeEqual` (resistente a ataques de temporización).
- Las sesiones tienen `expiresAt` (`SESSION_TTL_HOURS`, por defecto 720 h = 30 días)
  y se pueden revocar (`revokedAt`).
- Motivos: revocación inmediata sin lista negra, rotación sencilla y **ningún
  secreto de firma que custodiar** (a diferencia de un JWT).

> ⚠️ El token es un **secreto de portador**: quien lo tiene, entra. La SPA lo
> guarda en `localStorage`; si se requiere mayor rigor, el paso siguiente es
> emitirlo en una cookie `HttpOnly; Secure; SameSite` en lugar de en el cuerpo.

---

## 3. Superadmin inicial (*bootstrap*)

Al arrancar, si **no existe ningún usuario**, el backend crea el primer
SUPERADMIN a partir de:

| Variable | Descripción |
| --- | --- |
| `SUPERADMIN_EMAIL` | Correo del superadmin inicial. |
| `SUPERADMIN_PASSWORD` | Contraseña inicial (**cámbiala** tras el primer login). |
| `SUPERADMIN_NAME` | Nombre visible. |

Es **idempotente**: no vuelve a crear nada mientras exista al menos una cuenta.
Alternativa manual:

```bash
cd backend
npm run seed:superadmin
```

---

## 4. Endpoints (`/api/v1/auth`)

| Método y ruta | Auth | Descripción |
| --- | --- | --- |
| `POST /auth/login` | Pública | `{ email, password }` → `{ token, expiresAt, user }`. |
| `POST /auth/logout` | Sesión | Revoca la sesión actual → `204`. |
| `GET /auth/me` | Sesión | Usuario autenticado. |
| `POST /auth/me/password` | Sesión | Cambia la contraseña (`currentPassword`, `newPassword`); revoca las demás sesiones. |
| `GET /auth/users` | SUPERADMIN | Lista usuarios (`?tenantId=<uuid|shared>`). |
| `POST /auth/users` | SUPERADMIN | Crea un ADMIN (`email`, `password`, `name`, `tenantId?`). |
| `PATCH /auth/users/:id` | SUPERADMIN | Actualiza nombre/rol/tenant/estado. |
| `DELETE /auth/users/:id` | SUPERADMIN | Borra un usuario → `204`. |
| `POST /auth/register` | — | **404** (no existe registro). |

Los códigos de error no filtran información: credenciales incorrectas → `401`
genérico; usuario inexistente y contraseña incorrecta responden igual.

---

## 5. Middleware y política de rutas

- `requireAuth`: exige `Authorization: Bearer` válido y `isActive = true`.
- `optionalAuth`: adjunta el usuario si hay token, sin exigirlo.
- `requireRole("SUPERADMIN")`: autoriza por rol.

`backend/src/app/router.ts` aplica por defecto `requireAuth` a todo, salvo las
rutas marcadas explícitamente como públicas:

| Pública | Motivo |
| --- | --- |
| `GET /health`, `/system/*` | Sondas de salud / diagnóstico técnico. |
| `POST /auth/login` | Punto de entrada. |
| `GET /media/:id` | *Capability URL* de imagen (debe ir en `<img>`). |
| `GET /live/sessions/:id/results` | Consulta por `viewToken`/`hostToken`. |
| Socket.IO (`host:*`, `player:*`, `present:*`) | Autorizado por `hostToken`/`viewToken`/PIN. |

Todo lo demás (autoría de quizzes, gestión de medios, API de usuarios) requiere
sesión; verificado con `scripts/smoke-auth.mjs` (401 sin token, 403 con rol
insuficiente).

---

## 6. Desactivación de usuarios

`isActive = false` se evalúa **en cada petición**: los tokens ya emitidos pasan a
responder `403` de inmediato (no hace falta esperar a que caduque la sesión ni
revocarla explícitamente).

---

## 7. CORS

Endurecido en `backend/src/app/cors.ts`:

- `methods`: `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`.
- `allowedHeaders`: `Content-Type, Accept, Authorization, X-Request-Id,
  X-Correlation-Id, X-Tenant-Id, X-Session-Token`.
- `maxAge: 600`.

Comportamiento según `CORS_ORIGINS`:

| `CORS_ORIGINS` | Entorno | Efecto |
| --- | --- | --- |
| definido | cualquiera | Lista blanca + `credentials`. Preflight `204` para origen permitido; **sin** `Access-Control-Allow-Origin` para origen no permitido. |
| vacío | producción | `origin: false` → CORS no añade cabeceras (solo mismo origen `/sat`). |
| vacío | desarrollo | Refleja el origen de la petición. |

Verificado en `scripts/smoke-auth.mjs`: preflight de un origen permitido →
`204` con `Access-Control-Allow-Origin` correcto; origen no permitido → sin
cabecera CORS.

---

## 8. Interfaz (frontend)

- `frontend/src/modules/auth/`: `lib/auth-store.ts` (token en `localStorage`),
  `lib/api.ts`, `context/AuthContext.tsx`, `components/ProtectedRoute.tsx`,
  `pages/LoginPage.tsx`, `pages/UsersPage.tsx`, `pages/AccountPage.tsx`.
- `services/api-client.ts` adjunta el token y trata `401` redirigiendo a login.
- Rutas protegidas: `/account`, `/admin`, `/superadmin`, `/live/host`,
  `/live/editor`. Públicas: `/login`, y las pantallas de jugador/presentador
  (`/live/join`, `/live/play/:sessionId`, `/live/present/:sessionId`).
- `AppShell` muestra la navegación según el rol e incluye login/logout.

---

## 9. Verificación

`scripts/smoke-auth.mjs` — **40/40 comprobaciones** contra la pila real:

- `/health` público; login correcto/incorrecto/campos faltantes.
- `/auth/me` con token válido, sin token y con token inválido.
- `/auth/users` con sesión y con rol; crear usuario (débil/ok/duplicado).
- `/auth/register` → `404`.
- Un ADMIN **no** puede listar/crear usuarios (403).
- Desactivar → login `403`; reactivar; UUID inválido → `404`.
- `/live/quizzes` y `/media` protegidos (`401` sin token, `200` con token).
- `GET /media/:id` público (`image/png`).
- JSON malformado → `400`; ruta desconocida → `404`.
- CORS: preflight resuelto sin error de servidor.
- Borrado → `204`, login posterior `401`; logout → `204`, `/me` posterior `401`.

Los scripts de operación (`smoke-live.mjs`, `smoke-media.mjs`, `load-test.mjs`,
`seed-demo-quiz.mjs`, `seed-phishing-demo.mjs`) se autentican con
`scripts/lib/auth.mjs` (login con `SUPERADMIN_*` o `TXDXSAT_TOKEN`).
