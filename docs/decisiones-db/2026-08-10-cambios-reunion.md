# Decisiones de schema — Post-reunión 07/08/2026

**Fecha:** 10/08/2026
**Contexto:** 13 cambios del cliente (R-01…R-13). Acá solo las decisiones que tocan el modelo de datos.
**Principio:** normalizar, suponer en un día y corregir si cambia algo. Escalabilidad primero.

---

## Decisiones tomadas

### 1. R-06 · Retención y borrado → Anonimización

- **Decisión:** anonimizar en vez de borrado físico.
- **Por qué:** las FKs no tienen CASCADE (`items.parte_id`, `casos.creador_id`, `invitaciones`…) → borrado físico exige script de limpieza ordenado; la anonimización conserva el caso y el acuerdo para la contraparte. El cliente pidió explícitamente que la contraparte reciba una notificación cuando el usuario se dé de baja.
- **Consecuencias en schema:**
  - `usuarios.fecha_baja TIMESTAMPTZ` — cuándo se desactiva.
  - `usuarios.depuracion_programada_at TIMESTAMPTZ` — fecha de anonimización (baja + 6 meses).
  - El job de depuración anonimiza (no borra): `nombre`/`apellido` → "Usuario dado de baja", `email` → placeholder determinístico (`baja-<uuid>@anon.local`) para no romper el UNIQUE, `documento`/`telefono`/`preferencias_notificacion` → NULL, `activo = false`.
  - `auth.users` no se puede borrar (FK desde `usuarios.id`) → se mantiene con login deshabilitado.
  - Registros de `auditoria`, `firmas`, `pagos`, `facturas` y `acuerdos` no se tocan — conservan la trazabilidad legal; el usuario que los listó figura como "Usuario dado de baja".

### 2. R-09 · Facturación ARCA → Desde el día 1

- **Decisión:** facturar desde el día 1, sin ventana de gracia.
- **Por qué:** simplifica la lógica de negocio; todo pago aprobado genera factura. El comprobante debe ser descargable y enviarse por email (R-12).
- **Consecuencias en schema:**
  - Tabla nueva `facturas`: `id UUID PK`, `pago_id UUID FK → pagos`, `numero TEXT`, `cae TEXT` (opcional hasta tener credenciales reales), `url_pdf TEXT`, `neto NUMERIC(10,2)`, `iva NUMERIC(10,2)`, `impuestos NUMERIC(10,2)`, `total NUMERIC(10,2)`, `estado TEXT DEFAULT 'pendiente'` (valores: `pendiente`, `emitida`, `fallida` + reintentos), `created_at TIMESTAMPTZ`.
  - `configuracion` clave `impuestos` JSONB — parametrizable por país (IVA %, otros impuestos).
  - `planes.precio` pasa a representar el precio **neto** (sin impuestos).

### 3. R-07 · Quién paga → Post-registro

- **Decisión:** el invitado que debe pagar se registra primero, acepta la invitación y **después** paga.
- **Por qué:** mantiene el invariante "todo pago tocado por la app está asociado a un usuario autenticado"; evita el problema de pagos sin `usuario_id` colgados de una invitación. DB queda limpia con FKs directas.
- **Consecuencias en schema:**
  - `invitaciones.pago_a_cargo TEXT CHECK (pago_a_cargo IN ('invitador', 'invitado'))` — set en el momento de crear la invitación.
  - Sin cambios en `pagos` o `suscripciones`.

### 4. R-05 · Matrícula → Bucket privado

- **Decisión:** bucket de Storage privado, sin verificación del adjunto. Acceso: titular + admin.
- **Por qué:** consistente con la filosofía RLS del proyecto; la matrícula no es vinculante (acuerdo extrajudicial, lo vinculante es la firma digital) y falsificarla exigiría un esfuerzo desproporcionado.
- **Consecuencias en schema:**
  - `usuarios.numero_matricula TEXT` — número de matrícula profesional.
  - `usuarios.matricula_url TEXT` — ruta al adjunto (imagen/PDF) en el bucket.
  - Policy de Storage: `storage.objects` (authenticated: owner own objects + admin read all).

---

## Schema v1 — Cambios concretos agrupados

### Enums (ALTER TYPE ADD VALUE)

| Enum | Value nuevo | Req |
|---|---|---|
| `estado_caso` | `'expirado'` | R-04 |

### Tablas existentes (ALTER TABLE ADD COLUMN)

| Tabla | Columna | Tipo | Req |
|---|---|---|---|
| `usuarios` | `numero_matricula` | `TEXT` | R-05 |
| `usuarios` | `matricula_url` | `TEXT` | R-05 |
| `usuarios` | `fecha_baja` | `TIMESTAMPTZ` | R-06 |
| `usuarios` | `depuracion_programada_at` | `TIMESTAMPTZ` | R-06 |
| `invitaciones` | `pago_a_cargo` | `TEXT CHECK (IN ('invitador','invitado'))` | R-07 |
| `planes` | `limite_casos` | nullable (= ilimitado) | R-10 |

### Tablas nuevas

| Tabla | Req | Detalle |
|---|---|---|
| `facturas` | R-09 | `id PK, pago_id FK pagos, numero, cae, url_pdf, neto, iva, impuestos, total, estado DEFAULT 'pendiente', created_at` |
| `envios_email` | R-12 | `id PK, notificacion_id FK notificaciones, intentos INT, ultimo_error TEXT, created_at` |

### Configuración (INSERT / UPDATE en `configuracion`)

| Clave | Valor inicial | Req |
|---|---|---|
| `invitacion_ttl_horas` | `72` | R-04 |
| `impuestos` | `{"AR":{"iva":21,"otros_impuestos":0}}` | R-09 |

### Transiciones de máquina de estado (`validate_caso_estado_transition`)

| Desde | Hacia | Req |
|---|---|---|
| `nuevo` | `expirado` | R-04 |
| `activo` | `expirado` | R-04 |

### Jobs programados

| Job | Endpoint | Período | Req |
|---|---|---|---|
| Expirar invitaciones + casos | `GET /internal/invitaciones/sweep` | cada hora | R-04 |
| Depuración post-baja | `GET /internal/depuracion/sweep` | diario | R-06 |

### Storage

- Bucket `matriculas` con RLS: authenticated → owner own objects; admin → read all. R-05.

### Seed

- Plan "Estudio": `nombre = 'estudio'`, `limite_casos = NULL` (ilimitado), `precio = 25.00`, `limite_carpetas = NULL`, `limite_iteraciones_ia = NULL`.
- `configuracion`: `invitacion_ttl_horas`, `impuestos`.

---

## Pendientes no-bloqueantes

- **Credenciales ARCA:** CUIT / punto de venta / certificado. La tabla `facturas` y el módulo quedarán listos; la emisión real se activa cuando lleguen (P-02 en curso con la empresa).
- **Ubicación UI del ABM de planes (R-10):** `apps/panel` vs pantalla admin en la app. No toca el schema.
- **R-13 calendario:** post-MVP, no en este ciclo.
- **Precio del plan individual (P-03):** el ABM de planes se construye con el plan Estudio; el plan individual se agrega al seed/ABM cuando llegue el precio.
