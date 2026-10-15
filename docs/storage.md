# Almacenamiento de imágenes (Fase 3)

Documento del subsistema de medios de TXDXSAT: cómo se suben, validan, guardan,
sirven y borran las imágenes de preguntas y respuestas, y cómo migrar de
almacenamiento local a S3 sin tocar el dominio.

> Alcance de esta fase: **solo almacenamiento local** (`LocalFileStorage`) sobre un
> volumen Docker persistente. No se usa S3 ni ningún servicio externo, y **no se
> añaden contenedores**.

---

## 1. Resumen

- Las imágenes se suben por multipart a `POST /api/v1/media` (requiere sesión).
- Se validan por **firma binaria** (*magic bytes*), no por la extensión ni por el
  `Content-Type` declarado por el cliente.
- Se guardan en disco con **nombre UUID** dentro del volumen `txdxsat_uploads`,
  fuera de cualquier directorio público.
- La base de datos guarda **solo metadatos** (id, tenant, ruta relativa, MIME,
  tamaño, dimensiones y fecha); **nunca** el binario ni Base64.
- La lectura se hace por un **endpoint controlado** con una *capability URL*
  (UUID impredecible), apta para incrustar en `<img>`.
- El dominio depende de un puerto `FileStorage { upload, get, delete }`; la
  implementación actual es `LocalFileStorage`, y migrar a S3 es **cambiar un
  adaptador**.

---

## 2. Interfaz desacoplada (`FileStorage`)

Definida en `backend/src/modules/media/application/media.ports.ts`. La lógica de
negocio (casos de uso) no conoce el sistema de ficheros: solo habla con el puerto.

```ts
export interface StoredFile {
  key: string;          // ruta relativa, p. ej. "tenants/<tenantId>/questions/<uuid>.png"
  size: number;         // bytes reales
  mimeType: string;     // MIME derivado de la firma binaria
  width: number | null; // dimensiones si se pudieron leer
  height: number | null;
}

export interface FileStorage {
  upload(input: { key: string; buffer: Buffer; contentType: string }): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
```

`LocalFileStorage` (`infrastructure/`) es la única implementación y escribe bajo
`STORAGE_DIR`. Un futuro `S3FileStorage` implementaría la misma interfaz (mismos
métodos, mismas garantías) y se inyectaría en `media.module.ts`, sin cambios en
casos de uso, rutas ni base de datos.

---

## 3. Estructura en disco

Montaje del volumen en `compose.yaml`:

```yaml
services:
  backend:
    environment:
      STORAGE_DRIVER: local
      STORAGE_DIR: /app/storage
    volumes:
      - txdxsat_uploads:/app/storage

volumes:
  txdxsat_uploads:
    name: txdxsat_uploads
```

Distribución interna (relativa a `STORAGE_DIR`):

```
/app/storage/
├── tenants/
│   └── <tenantId>/
│       ├── questions/   # imagen principal de la pregunta
│       ├── answers/     # imágenes por respuesta
│       └── laboratories/# contenido de laboratorios (reservado)
└── shared/
    └── questions/       # imágenes sin tenant (ámbito compartido)
```

La ruta relativa se calcula a partir del tenant (o `shared`) y del propósito, y
se guarda en `MediaAsset.key`. El nombre de fichero es un **UUIDv4**; nunca se usa
el nombre original del cliente.

---

## 4. Persistencia del volumen

El volumen nombrado `txdxsat_uploads` **sobrevive** a:

| Operación | ¿Se conservan las imágenes? |
| --- | --- |
| Reinicio del backend (`docker restart` / reinicio del proceso) | Sí |
| Reconstrucción de la imagen (`docker compose up -d --build`) | Sí |
| `docker compose down` (sin `-v`) | Sí |
| `docker compose down && docker compose up` | Sí |
| Actualización de código / despliegue | Sí |
| `docker compose down -v` | **No — se borra el volumen** |

> ⚠️ `docker compose down -v` elimina el volumen `txdxsat_uploads` **y** los datos
> de PostgreSQL. En producción, además del volumen, se deben programar **copias de
> seguridad externas** (p. ej. snapshots EBS/AMI en EC2, o backup programado del
> directorio). El volumen Docker por sí solo no es un plan de respaldo.

Verificación manual de la persistencia:

```bash
# 1. Subir una imagen y anotar su id.
# 2. Reiniciar el backend.
docker compose restart backend
# 3. Volver a leer la imagen: los bytes deben ser idénticos.
curl -s "http://localhost:8080/sat/api/v1/media/<id>" -o /tmp/releido.png
```

---

## 5. Seguridad

| Riesgo | Mitigación |
| --- | --- |
| Fichero malicioso disfrazado de imagen | **Verificación por firma binaria** (`image/png`, `image/jpeg`, `image/webp`). Se ignora la extensión y el `Content-Type` del cliente. |
| Path traversal (`../../etc/passwd`) | El nombre de fichero lo genera el servidor (UUID) y la ruta se construye desde `STORAGE_DIR` + segmentos controlados; el cliente nunca aporta rutas. |
| Imagen sobredimensionada | Límite de tamaño configurable (`STORAGE_MAX_BYTES`, 5 MB por defecto) aplicado por `multer` en memoria → `413`. |
| Fuga entre tenants | `GET /media` y `DELETE /media/:id` están **scoped al tenant** y requieren sesión; un tenant no ve ni borra activos de otro (probado: `smoke-media.mjs`). |
| Exposición directa de ficheros | El almacenamiento está **fuera** de los directorios estáticos; solo se accede por el endpoint controlado. |
| Enumeración de imágenes | Las lecturas usan **UUID impredecible** (*capability URL*). Se emiten con `Cache-Control: private` para no retener imágenes de tenant en cachés compartidas. |
| Base de datos inflada | Solo se persisten metadatos; el binario vive en el volumen. **Nunca** `BYTEA`/Base64. |

Autorización de los endpoints:

| Endpoint | Requiere sesión | Ámbito |
| --- | --- | --- |
| `POST /api/v1/media` | Sí | tenant del usuario / `x-tenant-id` |
| `GET /api/v1/media` (listado) | Sí | tenant (listado acotado) |
| `GET /api/v1/media/:id` (lectura) | **No** | *capability URL* (UUID) |
| `DELETE /api/v1/media/:id` | Sí | tenant propietario |

### 5.1 Compromiso asumido: *capability URL* para la lectura

La imagen principal/por-respuesta debe poder incrustarse en un `<img>`, que **no
puede enviar cabeceras `Authorization`**. Por eso la lectura es pública pero
**no enumerable** (UUIDv4, ~122 bits de entropía): quien conoce el id ve la
imagen; quien no, no puede adivinarla.

Es un compromiso deliberado y documentado. Si en el futuro se exige lectura
autenticada, la ruta de migración es **URLs firmadas de vida corta** (HMAC del
id + expiración), servidas igualmente por `GET /media/:id`, sin cambiar el
almacenamiento ni el modelo de datos.

---

## 6. Modelo de datos

Tabla `media_assets` (migración `20261015090000_media_storage_and_answer_images`):

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | `uuid` (PK) | Identificador y *capability* de lectura. |
| `tenantId` | `uuid?` | Tenant propietario; `null` = ámbito compartido. |
| `key` | `String` | Ruta relativa dentro del volumen. |
| `mimeType` | `String` | MIME derivado de la firma binaria. |
| `size` | `Int` | Tamaño en bytes. |
| `width` / `height` | `Int?` | Dimensiones (si se pudieron leer). |
| `purpose` | `MediaPurpose` | `QUESTION`, `ANSWER` o `LABORATORY`. |
| `questionId` | `uuid?` | Pregunta asociada (referencia lógica). |
| `answerIndex` | `Int?` | Índice de la respuesta cuando `purpose = ANSWER`. |
| `createdAt` | `DateTime` | Fecha de creación. |

Además, `Question.optionImages` (`Json?`) guarda el **mapa** índice → URL de
imagen por respuesta. La URL pública almacenada es
`/api/v1/media/<id>`; **nunca** se guarda el binario.

---

## 7. API REST

Base: `/api/v1/media` (tras `/sat` en el despliegue público).

### `POST /api/v1/media` — subir (requiere sesión)

`multipart/form-data`:

| Campo | Obligatorio | Valor |
| --- | --- | --- |
| `file` | Sí | Imagen PNG / JPG / WebP (≤ `STORAGE_MAX_BYTES`). |
| `purpose` | No | `QUESTION` (defecto), `ANSWER`, `LABORATORY`. |
| `tenantId` | No | UUID; si falta, se usa el del usuario / ámbito compartido. |
| `questionId` | No | UUID de la pregunta asociada. |
| `answerIndex` | No | Entero (para `purpose = ANSWER`). |

Respuesta `201`:

```json
{
  "id": "5add3af8-a52b-4ec5-8526-6109503dbd7f",
  "url": "/api/v1/media/5add3af8-a52b-4ec5-8526-6109503dbd7f",
  "mimeType": "image/png",
  "size": 48213,
  "width": 960,
  "height": 540,
  "purpose": "QUESTION",
  "tenantId": null,
  "createdAt": "2026-10-15T09:00:00.000Z"
}
```

### `GET /api/v1/media/:id` — leer (público, *capability*)

Devuelve el binario con su `Content-Type`, `Content-Length` y
`Cache-Control: private, max-age=31536000, immutable`. `404` si el id no existe
o no es UUID.

### `GET /api/v1/media` — listar (requiere sesión)

`?purpose=QUESTION&tenantId=<uuid|shared>`; devuelve `{ "assets": [...] }`
acotado al tenant.

### `DELETE /api/v1/media/:id` — borrar (requiere sesión)

`204` si el tenant es propietario; `403`/`404` en caso contrario. Borra el
fichero del volumen y la fila de `media_assets`.

---

## 8. Integración con el editor de preguntas

El editor (`frontend/src/modules/live-sessions/pages/QuizEditorPage.tsx`) usa
`MediaUploader` y `MediaPicker`, apoyados en
`frontend/src/modules/live-sessions/lib/media.ts`:

- **Subida** con selección o *drag & drop*; validación de tipo y tamaño en cliente
  y, de nuevo, en servidor.
- **Optimización en cliente** con `canvas` (redimensionado/comprimido) antes de
  subir, para no acercarse al límite de 5 MB.
- **Vista previa**, reemplazo y **borrado**.
- **Reutilización** de imágenes ya subidas: el `MediaPicker` lista los activos del
  tenant (`GET /media`) para reutilizarlos sin volver a subirlos.
- Imagen principal de la pregunta y **hasta 4 imágenes de respuesta**.

Durante la partida, el presentador muestra la imagen principal
(`Question.imageUrl`) y, si existe, las imágenes por respuesta
(`Question.optionImages`). Al no haber imagen, el escenario **se reajusta**
automáticamente (layout sin imagen).

---

## 9. Variables de entorno

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `STORAGE_DRIVER` | Adaptador de almacenamiento (`local`). | `local` |
| `STORAGE_DIR` | Directorio de almacenamiento dentro del contenedor. **Debe** ser el volumen. | `/app/storage` |
| `STORAGE_MAX_BYTES` | Tamaño máximo por imagen, en bytes. | `5242880` (5 MB) |
| `STORAGE_PUBLIC_PREFIX` | Prefijo público de las *capability URLs*. | `/api/v1/media` |

---

## 10. Migración futura a S3 (sin tocar el dominio)

1. Implementar `S3FileStorage` con la misma interfaz `FileStorage`.
2. Registrar el adaptador en `media.module.ts` según `STORAGE_DRIVER`.
3. Ajustar `getMedia` para redirigir (302) a una URL prefirmada, o mantener el
   *streaming* a través del backend.

No cambian: casos de uso, rutas REST, tabla `media_assets` ni el editor. La
migración es un **cambio de adaptador**.

---

## 11. Verificación

| Prueba | Método | Resultado |
| --- | --- | --- |
| Subida real PNG | `node scripts/smoke-media.mjs` | `201`, id/url/mime/dimensiones/tamaño correctos |
| Lectura binaria idéntica | `smoke-media.mjs` | Bytes idénticos y `Content-Type: image/png` |
| Aislamiento entre tenants | `smoke-media.mjs` | El tenant B **no** ve ni borra el activo del tenant A |
| Rechazo de no-imagen | `smoke-media.mjs` | `422` (firma binaria inválida) |
| Rechazo de sobredimensión | `smoke-media.mjs` | `422`/`413` |
| Borrado del propietario | `smoke-media.mjs` | `204` y lectura posterior `404` |
| Persistencia tras reinicio | `docker compose restart backend` + relectura | Pendiente de registrar aquí (ver §4) |
| Demo de phishing | `node scripts/seed-phishing-demo.mjs` | Imagen subida + quiz creado con esa imagen |

`scripts/smoke-media.mjs` se ejecutó contra la pila levantada: **14/14
comprobaciones**. Los scripts se autentican con `scripts/lib/auth.mjs` (login con
`SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` o `TXDXSAT_TOKEN`).
