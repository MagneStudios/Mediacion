# Prompt — Documentar en `docs/database.md` los hallazgos de la auditoría

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación". `docs/database.md` es la documentación fuente de verdad del schema (árbol de migraciones, tablas, enums, reglas, consumidores). El pipeline manda que DBML y documentación reflejen el schema real: **nunca se documenta un objeto que no existe, ni se deja de documentar uno que sí existe**.

## Estado inicial

- Schema real: 30 tablas, 20 enums, 33 migraciones. `docs/database.md` ya documenta `avisos_version_legal` y `solicitudes_contacto` (líneas ~105-106) pero le faltan: la tabla `rate_limit_counters`, el enum `estado_caso` con su aclaración (N-3 de la auditoría), el patrón "tabla de rol de servidor" como regla explícita, y la FK N-1.
- Decisiones ya tomadas: `docs/decisiones-db/2026-08-18-respuestas-pm-auditoria-db.md`. No re-decidas; si encontrás un conflicto, documentalo y frená.

## Tareas

### 1. Documentar `rate_limit_counters` (falta por completo)

Fuente: `supabase/migrations/20260817130000_rate_limit_counters.sql`. Incluí:

- Propósito: contador compartido del rate-limit del módulo legal (soporta varias réplicas/serverless).
- PK compuesta `(clave, ventana_inicio)`, columna `hits`.
- Upsert atómico `ON CONFLICT ... DO UPDATE SET hits = hits + 1 RETURNING hits` (ventana fija, no deslizante).
- RLS habilitada + sin policies + GRANTs solo a `service_role`/`postgres`.
- Índice `idx_rate_limit_counters_ventana`.
- Consumidor: `apps/api/src/legal/rate-limit.repository.ts` (único escritor, como rol de servidor).

### 2. Documentar el enum `estado_caso` (cierra N-3)

- Agregar `estado_caso` a la lista de enums con sus 8 valores: `nuevo, activo, en_negociacion, acordado, cerrado, terminado, vencido, expirado`.
- Nota explícita: **no existe tabla `estados_caso`** — el endpoint de onboarding devuelve el catálogo de este enum. N-3 era un falso positivo de la auditoría (respuesta 7 del 18/08).

### 3. Documentar el patrón "tabla de rol de servidor" (cierra A-4/Q-4/R-2)

Agregar una sección o nota de patrón con la regla canónica:

> RLS habilitada + sin policies + GRANTs solo a `service_role`/`postgres` + escritura únicamente vía BE (rol de servidor). El usuario final no lee ni escribe; su comprobante es el `codigo` (`ARR-…`/`CON-…`).

Tablas que lo siguen (4): `solicitudes_arrepentimiento`, `avisos_version_legal`, `solicitudes_contacto`, `rate_limit_counters`. Contraste explícito con `user_agreements`, que **no** sigue el patrón: tiene SELECT propio para `authenticated` porque el contrato FE lo exige.

### 4. Documentar la FK N-1

`solicitudes_arrepentimiento.usuario_id → auth.users(id) ON DELETE SET NULL`, junto con la regla de retención del resto de las tablas legales (`user_agreements` RESTRICT, `avisos_version_legal` RESTRICT, `solicitudes_contacto` SET NULL): ninguna FK legal con `ON DELETE CASCADE`.

### 5. No inventar (prohibido explícito)

No documentar `notify_change_of_state()`, `cambios_caso`, `pagos_stripe`, `tabla_origen` ni `items_fijos_por_negociacion`: **no existen en el schema** (respuestas 2, 5 y 6 del 18/08). Si la auditoría los menciona, es un artefacto; el remedio es no documentarlos, no crearlos.

## Verificación

- `docs/database.md` debe listar las 30 tablas (contar la lista) y los 20 enums.
- Releer el archivo completo y confirmar que no hay referencias a objetos inexistentes.
- No hay migraciones ni tests que correr: este prompt es solo documentación.

## Documentación del resultado (obligatorio)

Al terminar, documentá en **`docs/changelogs-db/2026-08-18.md`** (archivo ya creado, sección **"database.md"**): qué secciones se agregaron/corrigieron, con qué evidencia (migración fuente de cada dato) y cualquier desvío encontrado.
