# Prompt — Sincronizar `mediacion.dbml` con el schema post-auditoría

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación". Seguís el pipeline: **DBML → migraciones (RLS y triggers en este mismo paso, no después) → testing de migraciones → scripts Python → QA/E2E → staging → producción en Supabase**. El DBML (`mediacion.dbml`) es el diagrama fuente de verdad del diseño; los índices y las notas de diseño viven en él, no como afterthought.

## Estado inicial

- Schema real: 30 tablas, 20 enums, 33 migraciones (`supabase/migrations/`). La última, `20260817140000_has_accepted_current_vigencia.sql`.
- `mediacion.dbml` tiene 29 tablas: le falta **solo** `rate_limit_counters` (creada en `20260817130000_rate_limit_counters.sql`). Las otras dos tablas del módulo BE legal (`avisos_version_legal`, `solicitudes_contacto`) ya están dibujadas.
- `packages/db-types/src/database.types.ts` ya tiene las 3 tablas — **no lo toques en este prompt**.
- Decisiones ya tomadas: `docs/decisiones-db/2026-08-18-respuestas-pm-auditoria-db.md` (respuestas 3 y 6). No re-decidas; si encontrás un conflicto, documentalo y frená.

## Tareas

### 1. Agregar `Table rate_limit_counters`

Fuente exacta: `supabase/migrations/20260817130000_rate_limit_counters.sql`. Columnas tal cual la migración (incluida la PK compuesta `(clave, ventana_inicio)`), más:

- Nota de diseño: contador compartido del rate-limit del módulo legal (`apps/api/src/legal/rate-limit.repository.ts`); upsert atómico `INSERT ... ON CONFLICT (clave, ventana_inicio) DO UPDATE SET hits = hits + 1 RETURNING hits`; ventana fija (no deslizante); las ventanas vencidas se barren al abrir un bucket nuevo.
- Nota de patrón: tabla de rol de servidor — RLS habilitada, sin policies, GRANTs solo a `service_role`/`postgres` (patrón canónico del 18/08).
- Índice `idx_rate_limit_counters_ventana` sobre `ventana_inicio`.

### 2. Verificar las dos tablas ya dibujadas (sin drift)

Releé `avisos_version_legal` y `solicitudes_contacto` contra `20260815120000_legal_avisos_contacto.sql` (columnas, FKs, índices, notas). Si hay drift, corregilo en el DBML. Si están exactas, no las toques.

### 3. Verificar enums

- `estado_arrepentimiento` con sus 4 valores (`recibida`, `en_proceso`, `resuelta`, `rechazada`).
- `estado_caso` con `expirado` incluido (8 valores en total, agregado en `20260810120000`).
- Si falta alguno, agregarlo; si están completos, no los toques.

### 4. Nada más

Este prompt es **solo diagrama**: no se crea ninguna migración, no se toca `database.md`, ni scripts, ni db-types. Las respuestas 2, 5 y 6 de `docs/decisiones-db/2026-08-18-respuestas-pm-auditoria-db.md` prohíben dibujar `pagos_stripe`, `items_fijos_por_negociacion` o cualquier objeto que no exista en el schema real.

## Verificación

- Lectura completa del DBML: 30 `Table`, todos los enums presentes y consistentes con las migraciones.
- Cruzar cada columna de `rate_limit_counters` con la migración (a ojo es suficiente; no hay generador de diagramas instalado en el repo).
- No hay reset ni tests que correr: nada del DB se modifica.

## Documentación del resultado (obligatorio)

Al terminar, documentá en **`docs/changelogs-db/2026-08-18.md`** (archivo ya creado, sección **"DBML"**): qué se agregó/corrigió, evidencia de la verificación y cualquier desvío encontrado. Si encontrás un conflicto con una decisión previa, documentalo en el changelog y no lo resuelvas por tu cuenta.
