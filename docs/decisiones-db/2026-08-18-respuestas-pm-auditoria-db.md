# Respuestas PM de la auditoría — resueltas con evidencia de DB

**Fecha:** 18/08/2026
**Contexto:** `docs/Audit_Report_DB_Requirements_2026-08-18.md` dejó 5 preguntas para PM (Q-2…Q-6) y varios riesgos/gaps (R-1…R-5, N-1…N-6). El rol DB las resolvió contra la evidencia del repo: las 33 migraciones de `supabase/migrations/`, el código de `apps/api/src/` y los changelogs. Varios hallazgos de la auditoría referencian migraciones u objetos que **no existen en el repo** (`20260806180000`, `20260815000000`, `pagos_stripe`, `notify_change_of_state()`, `cambios_caso`, `items_fijos_por_negociacion`) — artefactos de una corrida contra otro estado. Ninguna respuesta de este documento requiere migración nueva.
**Principio:** no se crea schema, constraints ni documentación para objetos que no existen o que ningún consumidor requiere (pipeline: DBML → migración justificada → QA → staging → producción).

---

## Respuestas

### 1. Q-2 — `estados_invitacion`: `pagado_parcial` y `reembolsado` no existen

- **Evidencia:** el enum en `20260721191644_enums.sql` es `('pendiente', 'aceptada', 'rechazada', 'expirada')`. La auditoría los ubica en `20260806180000`, migración inexistente.
- **Respuesta:** no crear valores. R-13 (pagos denormalizados) está diferido post-MVP (changelog 2026-08-10).
- **Consecuencia:** cuando R-13 avance, `ALTER TYPE ADD VALUE` + DBML + db-types en su propio cambio, siguiendo el pipeline.

### 2. Q-3 / N-2 / N-6 / R-4 — `notify_change_of_state()` no existe

- **Evidencia:** grep exhaustivo en las 33 migraciones y en `apps/api`: cero ocurrencias de `notify_change_of_state`, `cambios_caso` o la migración `20260815000000` que la auditoría cita.
- **Respuesta:** no documentar ni implementar el comportamiento de un trigger inexistente. El cambio de estado del caso ya está gobernado por `validate_caso_estado_transition()` (máquina de estados, `20260721191658`) y las notificaciones reales las inserta BE en `notificaciones`.
- **Consecuencia:** queda registrado como **trabajo nuevo**: se abre cuando Producto defina contenido, destinatarios y canal de la notificación de cambio de estado.

### 3. Q-4 / A-4 / R-2 — `solicitudes_arrepentimiento` y las tablas server-only: service-role only es la intención

- **Evidencia:** el instructivo Golosetti define el formulario de arrepentimiento como **público** (sin auth); el flujo es FE público → BE → INSERT como rol de servidor. `20260814170000_tyc_legal.sql` y `20260815120000_legal_avisos_contacto.sql` ya implementan "RLS habilitada + sin policies + GRANTs solo a `service_role`/`postgres`".
- **Respuesta:** confirmar el patrón **"tabla de rol de servidor"** como intencional y canónico para 4 tablas: `solicitudes_arrepentimiento`, `avisos_version_legal`, `solicitudes_contacto`, `rate_limit_counters`. `user_agreements` queda **fuera** del patrón: tiene SELECT propio para `authenticated` porque el contrato FE lo exige (decisión 1 del 14/08).
- **Consecuencia:** documentar el patrón en `database.md` y cubrirlo con checks de `validate_rls.py` (anon/authenticated no leen ni escriben las 4 tablas).

### 4. Q-5 / R-3 — `notificaciones.canal` ya es enum; la auditoría partió de una premisa falsa

- **Evidencia:** `canal canal_notificacion NOT NULL` con enum `('email', 'push')` desde el modelo inicial (`20260721191644` + `20260721191651`). El campo `estado` pasó de TEXT a enum `estado_notificacion` (`'pendiente', 'enviada', 'fallida'`) en `20260728000000_notificaciones_estado_enum.sql`. La columna TEXT sin constraint que describe la auditoría no existe.
- **Respuesta:** no migrar nada. Valores válidos: `canal` ∈ {`email`, `push`}; `estado` (de entrega) ∈ {`pendiente`, `enviada`, `fallida`}.
- **Consecuencia:** Q-5 y R-3 cerrados sin acción.

### 5. Q-6 / R-5 / N-4 — `pagos_stripe.tabla_origen`: la tabla no existe

- **Evidencia:** cero ocurrencias de `pagos_stripe` en las migraciones y en `apps/api`. El discriminador `tabla_origen` que describe la auditoría no está implementado.
- **Respuesta:** no crear constraint para una tabla inexistente. Cuando se cree `pagos_stripe` (si R-13 la requiere), el CHECK de `tabla_origen` se define en su propia migración con DBML previo (pipeline).
- **Consecuencia:** Q-6 cerrada: no hay valores válidos que documentar todavía.

### 6. A-3 / R-1 — `items_fijos_por_negociacion.id` BIGINT: la tabla no existe

- **Evidencia:** cero ocurrencias en migraciones, en `mediacion.dbml` y en `EXPECTED_TABLES` de `smoke_migrations.py`. La asimetría BIGINT/UUID que describe la auditoría no está en el schema.
- **Respuesta:** no documentar nada de una tabla inexistente.
- **Consecuencia:** si la tabla se crea en el futuro, el tipo de `id` se decide en su migración (convención del repo: UUID con `gen_random_uuid()`).

### 7. N-3 — `estados_caso` no es una tabla: es el enum `estado_caso`

- **Evidencia:** el endpoint de onboarding devuelve el catálogo del enum `estado_caso` (`nuevo, activo, en_negociacion, acordado, cerrado, terminado, vencido, expirado` — `expirado` agregado en `20260810120000`). No existe ninguna tabla `estados_caso` en las 33 migraciones.
- **Respuesta:** cerrar el gap documentando el enum `estado_caso` en `database.md` (sección de enums), no como tabla.
- **Consecuencia:** N-3 resuelto por documentación.

### 8. N-1 — FK `solicitudes_arrepentimiento.usuario_id → auth.users(id)`

- **Evidencia:** definida con `ON DELETE SET NULL` en `20260814170000_tyc_legal.sql` (decisión 3 del 14/08).
- **Respuesta:** documentarla en `database.md` junto con las demás FKs de las tablas legales (RESTRICT para `user_agreements`/`avisos_version_legal`, SET NULL para `solicitudes_arrepentimiento`/`solicitudes_contacto`).
- **Consecuencia:** N-1 resuelto por documentación.

---

## Plan de trabajo derivado

Tres prompts en `docs/prompts-db/` implementan lo único que esta auditoría deja pendiente en el alcance DB (sin migraciones nuevas):

1. `sincronizar-dbml-tablas-faltantes.md` — agregar `rate_limit_counters` al diagrama.
2. `documentar-database-md-post-auditoria.md` — `rate_limit_counters`, enum `estado_caso`, patrón server-only, FKs.
3. `extender-qa-scripts-tablas-server-only.md` — smoke 27→30 tablas y validate_rls con cobertura de las tablas server-only.

Los tres documentan su resultado en `docs/changelogs-db/2026-08-18.md`.

## Fuentes

- Migraciones en `supabase/migrations/` (33 archivos, verificadas con grep)
- `docs/decisiones-db/2026-08-14-tyc-contrato-con-db.md` (decisiones 1-7)
- `docs/Instructivo_Implementacion_TyC_-_Golosetti_Abogados.md` (formulario público, Res. 424/2020)
- `docs/changelogs-db/2026-08-14.md`, `docs/changelogs-db/2026-08-15.md`
- `docs/changelogs/2026-08-10.md` (R-13 diferido), `docs/changelogs/2026-08-17.md` (fixes críticos)
