# Plan de implementación — Cambios reunión 07/08/2026 (R-01…R-13)

**Fuente:** `docs/Cambios_Reunion_Mediacion_07-08-2026.md`
**Meta:** MVP septiembre 2026 · **Ventana:** semana del 11/08
**Pipeline:** DBML → migraciones (RLS/triggers) → testing de migraciones → scripts Python → QA/E2E → staging → producción (Supabase)

---

## 1 · Mapa de capas por requerimiento

| Req | Título (prio) | Capa(s) afectada(s) | Impacto en DB | Tipo de cambio | Bloqueado por |
|---|---|---|---|---|---|
| R-01 | Logo nuevo (Media) | Frontend + assets | — | Design/assets | — (origen del asset: §5-Q5) |
| R-02 | Mantener paleta (Media) | Frontend (tokens) | — | No-hacer / validar | — |
| R-03 | Lenguaje llano (ALTA) | Frontend (i18n) + Backend (mensajes/plantillas) | — | Auditoría transversal de copies | — |
| R-04 | Invitaciones 72 h + estado EXPIRADO (Media) | **DB + API + Frontend** | **Sí** | Enum + job + estado de caso | — |
| R-05 | Matrícula en alta (Media) | **DB + API + Frontend** + Storage | **Sí** | Columnas + bucket | — |
| R-06 | Retención/borrado (ALTA) | **DB + API** | **Sí** | Columnas + job | Definición PM (§5-Q1) |
| R-07 | Quién paga (Media) | **DB + API + Frontend** | **Sí** | Columna + checkout | R-08/09/10 (infra pagos) |
| R-08 | MP cuenta definitiva (ALTA) | Infra + Backend + QA | Solo configuración | Envs + webhook de baja | **P-04** |
| R-09 | Facturación ARCA (ALTA) | **Backend + DB** + Frontend (checkout) | **Sí** | Tabla `facturas` + integración nueva | **P-03** + credenciales ARCA (§5-Q2) |
| R-10 | Precios configurables + plan estudios (ALTA) | **Backend + Frontend/panel** + DB | Sí (menor) | ABM + seed + flag ilimitado | **P-03** (precio individual) |
| R-11 | Dominio y casillas (ALTA) | Infra + config SMTP | — | DNS/SPF/DKIM/DMARC | **P-01** |
| R-12 | Emails (ALTA) | **Backend + DB** | **Sí** | Tabla log + plantillas | R-11, R-04, R-03 |
| R-13 | Calendario desde ítems (Baja) | **DB + Backend + Frontend** | Sí (menor) | Columna + `.ics` | post-MVP (fuera de sprint) |

---

## 2 · Impacto en el modelo de datos

### 2.1 Con impacto directo

| Req | Cambio en schema | Detalle |
|---|---|---|
| R-04 | `ALTER TYPE estado_caso ADD VALUE 'expirado'` | `estado_caso` hoy: `nuevo, activo, en_negociacion, acordado, cerrado, terminado, vencido`. Agregar `expirado` + transición `nuevo → expirado` en `validate_caso_estado_transition`. TTL 72 h recomendado como `configuracion.invitacion_ttl_horas` (editable sin deploy) en vez de la constante de 7 días hardcodeada en `apps/api/src/invitaciones/invitation-ttl.ts`. |
| R-05 | `usuarios.numero_matricula TEXT` + `usuarios.matricula_url TEXT` | + bucket de Storage privado para el adjunto (imagen/PDF). Sin flujo de verificación (acuerdo extrajudicial). |
| R-06 | `usuarios.fecha_baja TIMESTAMPTZ` + `usuarios.depuracion_programada_at TIMESTAMPTZ` | Pendiente de definición (§5-Q1): borrado físico vs anonimización. **Ojo:** FKs sin CASCADE (`items.parte_id`, `casos.creador_id`, `invitaciones.caso_id`…) → borrado físico exige script de limpieza ordenado; anonimización conserva el caso/acuerdo para la contraparte. |
| R-07 | `invitaciones.pago_a_cargo` (`invitador` / `invitado`) | Enum nuevo o TEXT con CHECK. |
| R-09 | Tabla nueva `facturas`: `id, pago_id FK, numero, cae, url_pdf, neto, iva, impuestos, total, moneda, created_at` | + `configuracion` clave `impuestos` JSONB (parametrizable por país — requisito explícito de la reunión) + `planes.precio` = precio neto (los publicados no incluyen impuestos). |
| R-10 | `planes.limite_casos` nullable (= ilimitado) o flag `limite_ilimitado BOOLEAN` | + seed plan "Estudio" USD 25/mes (sin retroactividad sobre suscripciones existentes). |
| R-12 | Log de envíos: `notificaciones.intentos INT` + columna de error, o tabla `envios_email` | La tabla separada es más limpia para reintentos y trazabilidad. |
| R-13 | `items.fecha_evento TIMESTAMPTZ` | Alternativa: derivar a `tareas` (ya tiene `fecha_evento`). Post-MVP. |

### 2.2 Sin impacto en la base

R-01, R-02, R-03 (solo mensajes/copies; los `error.code` del API se conservan), R-08 (envs), R-11 (infra).

### 2.3 Solo configuración

| Req | Qué |
|---|---|
| R-08 | Credenciales MP de producción por variables de entorno |
| R-10 | Planes ya viven en BD (`planes` + seed) = editables sin deploy; falta solo el ABM |
| R-11 | Config SMTP / remitente + DNS |

### 2.4 Jobs programados

| Job | Req | Período | Mecanismo |
|---|---|---|---|
| Marcar invitaciones expiradas + caso a `expirado` | R-04 | horario | Extender `vencimiento.scheduler` + endpoint `/internal/invitaciones/sweep` + cron GH |
| Recordatorio antes de las 72 h | R-12 | horario | Mismo sweep |
| Depuración 6 meses post-baja (+ aviso previo) | R-06 | diario | Nuevo `/internal/depuracion/sweep` + cron GH |

---

## 3 · Plan de implementación por fases

> **Regla de cierre por fase:** actualizar `mediacion.dbml`, `docs/database.md`, `docs/mediacion_db_develop.md`, `packages/db-types` (mantenido a mano — `main: src/index.ts`) y regenerar `backup.sql` / `solo_public.sql`.
> Todas las migraciones de esta entrega son **aditivas** (ADD VALUE / ADD COLUMN / tabla nueva) → no rompen lo ya construido.

### Fase 0 — Transversales, sin DB, paralelizables

- **R-01** — assets del logotipo nuevo (SVG + PNG color/monocromo/negativo) aplicados en splash, header, favicon y emails.
- **R-02** — congelar la paleta acuática actual, sin cambios (solo validación; el rojo queda para errores puntuales).
- **R-03** — arrancar auditoría de copies: catálogo de términos prohibidos ("partes", "vigencia", "vinculante", "extrajudicial"), checklist de pantallas/errores/emails/notificaciones; i18n es-AR/en; nivel primaria, voz activa, segunda persona.

### Fase 1 — R-04 · Ciclo de vida de invitación (primero: chico, sin dependencias, y sus eventos son base de R-12)

**DB**
- DBML: `estado_caso` + `expirado`; máquina de estados con transición `nuevo → expirado`.
- Migración: `ADD VALUE 'expirado'`, TTL en `configuracion`, transición en el trigger.
- Testing de migraciones: `smoke_migrations.py` + `validate_rls.py` + suite SQL (`scripts/tmp`).
- Actualizar `db-types`, DBML, docs y dumps.

**Backend (API)**
- TTL 72 h configurable (reemplazo de `invitation-ttl.ts`).
- Sweep de expiración: `invitaciones → expirada` + `casos → expirado` (idempotente, patrón del sweep existente).
- Bloqueo de reenvío sobre caso `expirado` (requiere crear caso nuevo).
- Respuesta "invitación vencida" en `POST /casos/unirse` para links caducos.
- Mensajes de error en lenguaje llano (R-03).

**Frontend**
- Pantalla de "invitación vencida" para quien abre un link caduco.
- Botón de reenvío deshabilitado en caso `expirado`; caso visible en historial con ese estado.
- Texts R-03.

**QA**
- Adaptar las 14 specs de invitaciones (hoy prueban 8 días) a 72 h + casos de expiración proactiva (job) y pre-unión.

### Fase 2 — R-06 · Retención y borrado (requiere §5-Q1 para el diseño exacto; el patrón de job no bloquea)

**DB**
- DBML + migración: `fecha_baja`, `depuracion_programada_at` (+ política de anonimización si aplica según Q1).
- Scripts de validación (smoke/RLS).

**Backend (API)**
- Job diario de depuración a los 6 meses de la baja; aviso previo (email cuando exista R-11/R-12; mientras tanto, registro en `notificaciones`).
- Política en T&C + lectura del estado de retención si hace falta.
- Mantener los 10 años para usuarios con suscripción activa (criterio: `estado_suscripcion = 'activa'`).

**Frontend**
- Aviso de borrado próximo (si aplica) en perfil; texto legal en `profile/legal`.

**QA**
- Integración: suscripción activa → no se programa; `cancelada`/`vencida` → programa a 6 meses; corrección de la ventana.

### Fase 3 — Monetización · R-10 → R-09 → R-08 → R-07 (cadena; R-10 primero para poder probar sin MP real)

**R-10 — Precios configurables y plan estudios**
- **DB:** seed plan "Estudio" (USD 25, casos ilimitados) + ajuste `limite_casos` nullable / flag.
- **Backend:** ABM de planes (CRUD `@Roles("admin")`; ya existe `GET /planes`).
- **Frontend:** gestión de planes en panel admin (ubicación según §5-Q3: `apps/panel` vs pantalla admin de la app).
- **QA:** precios nuevos impactan solo suscripciones nuevas.

**R-09 — Facturación ARCA**
- **DB:** tabla `facturas` + `configuracion.impuestos` JSONB (por país).
- **Backend:** módulo ARCA (provider nuevo, patrón DocuSign/MP: cliente + envs + reintentos), emisión de comprobante, cálculo neto + IVA + impuestos, desglose en checkout, comprobante descargable y por email (R-11).
- **Frontend:** checkout con importes discriminados (neto + impuestos + total) y descarga del comprobante.
- **QA:** sandbox ARCA si llegan credenciales (§5-Q2).

**R-08 — Mercado Pago producción**
- **Infra/config:** envs de producción (P-04).
- **Backend:** webhook de **baja** (hoy cubre aprobado/rechazado) → `estado_suscripcion.cancelada`.
- **QA:** suscripciones recurrentes end-to-end (preapproval), webhooks aprobado/rechazado/baja, layer desacoplada.

**R-07 — El invitador define quién paga**
- **DB:** `invitaciones.pago_a_cargo`.
- **Backend:** imputación del cobro al invitador si elige "yo pago"; si elige "pagás vos", checkout para el invitado antes de acceder al caso (gate en `POST /casos/unirse`).
- **Frontend:** selector en el flujo de invitación; checkout de aceptación según §5-Q4.

### Fase 4 — Comunicaciones · R-11 → R-12 (al final: R-11 espera P-01; las plantillas necesitan identidad R-01/R-02 y lenguaje R-03)

**R-11 — Dominio propio y casillas**
- **Infra:** dominio + DNS + SPF/DKIM/DMARC + casillas (soporte y no-reply) + config SMTP del API.
- **QA:** entregabilidad (spam test), verificación de remitente institucional.

**R-12 — Notificaciones por email**
- **DB:** log de envíos / reintentos (columna en `notificaciones` o tabla `envios_email`).
- **Backend:** plantillas con identidad nueva y lenguaje llano; eventos mínimos: invitación enviada · aceptada o rechazada · recordatorio 72 h (R-04) · invitación vencida (R-04) · nueva propuesta o cambio en negociación · acuerdo firmado; registro de envíos y reintentos ante fallo.
- **QA:** disparo por evento (unit + integración) y reintentos.

### Fase 5 — R-05 · Matrícula (ventana libre de la semana) y R-13 (post-MVP)

**R-05 — Matrícula profesional en el alta**
- **DB:** columnas en `usuarios` + bucket de Storage.
- **Backend:** alta/edición de matrícula y adjunto en `POST /auth` y perfil; sin verificación.
- **Frontend:** campos en `signup` y `profile`.
- **QA:** privacidad del bucket según §5-Q6.

**R-13 — Calendario desde ítems del acuerdo**
- Documentado como post-MVP. DB: `items.fecha_evento` (o vía `tareas`). Backend: generación `.ics`. Frontend: botón "Agregar al calendario" (único y recurrente).

---

## 4 · Dependencias con pendientes del cliente

| Requerimiento | Pendiente | Efecto si no llega |
|---|---|---|
| R-11 | P-01 (nombre/dominio) | Bloquea el envío de emails del producto entero (R-12 + avisos de R-06) |
| R-08 | P-04 (cuenta MP empresa) | Bloquea cobros reales; se puede preparar todo en test |
| R-09 / R-10 | P-03 (precio individual + alcance de facturación) | Bloquea el ABM completo y los comprobantes; se puede cargar el plan estudio |
| R-09 | Credenciales ARCA (cuenta/tipo de comprobante; la empresa está en formación) | No listado en P-01…P-05 — **ver §5-Q2** |
| P-02 | Validación de firma DocuSign en la próxima entrega | No bloquea requerimientos listados; es el elemento vinculante del acuerdo (vigilar) |

---

## 5 · Preguntas para el PM (traban implementación — confirmar mañana)

1. **R-06 (ALTA · bloquea diseño de migración y job):** ¿borrado **físico** o **anonimización** de los datos del usuario dado de baja? La base no tiene CASCADE en `items.parte_id` / `casos.creador_id`, así que el borrado físico es un script de limpieza en orden; la anonimización conserva el caso (y el acuerdo) para la contraparte. ¿Qué pasa con los casos del usuario dado de baja: se conservan en el historial de la otra parte?
2. **R-09 (ALTA · bloquea el desarrollo del módulo):** ¿quién provee las credenciales de ARCA (CUIT, punto de venta, certificado)? No figura en P-01…P-05. ¿Sumamos ese pendiente y con qué plazo? ¿Se factura desde el día 1 (P-03) o hay ventana de gracia?
3. **R-10:** ¿el ABM de planes vive en `apps/panel` (pendiente de desarrollo) o en una pantalla admin dentro de la app móvil? Define el scope de frontend de la Fase 3.
4. **R-07:** el invitado que debe pagar: ¿checkout **antes** de registrarse (link de MP externo, sin auth) o **después** de crear cuenta y aceptar la invitación? Cambia el flujo de `join`.
5. **R-01:** ¿el isotipo nuevo (dos personas abrazándose) lo entrega el cliente o lo produce el equipo? Define si R-01 es "integrar asset" o "producir asset".
6. **R-05:** adjunto de matrícula: ¿bucket **privado** (solo el titular + admin) o público? ¿Límite de tamaño/tipo?

**Supuestos default mientras no haya respuesta:** R-06 anonimización + caso conservado; checkout de R-07 post-registro; bucket privado en R-05.