# Prompt — Implementar módulo legal (TyC): `legal_documents`, `user_agreements`, `solicitudes_arrepentimiento`

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación" (plataforma de mediación y acuerdos extrajudiciales). Seguís el pipeline: **DBML → migraciones (RLS y triggers en este mismo paso, no después) → testing de migraciones → scripts Python → QA/E2E → staging → producción en Supabase**. Stack: PostgreSQL 17 local (`supabase/config.toml` puertos 57001/57002/57003), 28 migraciones secuenciales en `supabase/migrations/` (última: `20260814160000_grants_schema_public.sql`), 24 tablas, 47 policies RLS. Los tipos de BD (`packages/db-types`) se mantienen **a mano**. Los índices se diseñan en la fase de DBML/migración, no como afterthought.

## Estado inicial

- 24 tablas en `public`, 19 enums, 28 migraciones; `smoke_migrations.py` 66/66, `validate_rls.py` 17/17.
- La plataforma hoy **no registra ninguna aceptación legal**: el usuario se registra y contrata sin dejar prueba (gap que cierra este módulo).
- FE ya tiene su capa completa contra mocks (rama `feat/frontend-tyc-aceptacion`): páginas públicas, checkboxes, gate de re-aceptación, `/arrepentimiento`. El contrato congelado de lo que FE espera de DB/BE está en `docs/tyc-contrato-frontend.md` — **no cambies ningún nombre de columna sin PR propio y aviso explícito** (§05 del anexo).
- Las decisiones de diseño ya están tomadas: `docs/decisiones-db/2026-08-14-tyc-contrato-con-db.md`. No re-decidas; si encontrás un conflicto, documentalo y frená.

## Contexto y decisiones (resumen operativo)

Fuentes: `docs/tyc-contrato-frontend.md` (shapes exactos §2 y §3), `docs/reparto-tyc-devs.md` (§02 DB), `docs/Instructivo_Implementacion_TyC_-_Golosetti_Abogados.md`, `docs/decisiones-db/2026-08-14-tyc-contrato-con-db.md` (decisiones 1-7).

1. **`legal_documents`** — texto completo en la base, no en el front. Columnas congeladas: `tipo` (`'terms' | 'privacy'`), `version` TEXT (`v1.0`), `contenido` TEXT (formato `## X. TÍTULO` = sección, resto = párrafo), `valid_from` TIMESTAMPTZ, `valid_to` TIMESTAMPTZ NULL (NULL = vigente), `is_substantial` BOOLEAN, `resumen_cambios` TEXT NULL. Una sola vigente por tipo (partial unique). Lectura pública: policy SELECT para `anon` y `authenticated`. Seed v1.0 de terms y privacy con el contenido de `mediacion-app/mocks/legal-texts.ts` ya normalizado (los `[COMPLETAR]` quedan visibles — bloqueo de Administración, no publicar versión hasta completarlos).
2. **`user_agreements`** — registro legal append-only. Columnas congeladas (mínimo del anexo): `user_id UUID FK auth.users(id) ON DELETE RESTRICT`, `document_type` (`'terms' | 'privacy' | 'marketing'`), `document_version` TEXT, `accepted_at TIMESTAMPTZ DEFAULT now()`, `ip INET`, `user_agent` TEXT, `accepted` BOOLEAN. Un registro por aceptación y por tipo; `marketing` con `accepted = false` también se guarda.
   - **Permisos (decisión 1):** GRANT INSERT a `service_role` + `postgres`. Nada de INSERT para `authenticated`/`anon`. SELECT de `authenticated`: policy RLS de filas propias. UPDATE/DELETE: **trigger que rechaza siempre, para todos los roles incluido `service_role`** (append-only real; `bypassrls` no lo saltea).
   - Índices para el export y para "¿aceptó la versión vigente?".
3. **Regla anti-contratación (decisión 2):** trigger `BEFORE INSERT` en `suscripciones` para filas con `usuario_id`: debe existir aceptación de `terms` con `accepted = true` y `document_version` == versión vigente de `legal_documents` (`valid_to IS NULL`). Lógica en `has_accepted_current(user_id, document_type)` (SECURITY DEFINER, `search_path = ''`, InitPlan donde aplique). Para `estudio_id` no se define regla este ciclo (documentar como pendiente).
4. **`solicitudes_arrepentimiento` (decisión 3):** traza del POST público `/legal/arrepentimiento` (Res. 424/2020). `id UUID PK`, `codigo TEXT UNIQUE` por trigger (`ARR-0001…`, patrón `casos.codigo`), `nombre`, `email`, `detalle`, `received_at TIMESTAMPTZ DEFAULT now()`, `estado` enum nuevo `estado_arrepentimiento` (`recibida`/`en_proceso`/`resuelta`/`rechazada`), `usuario_id UUID NULL FK auth.users ON DELETE SET NULL`, timestamps + trigger de auditoría (patrón `audit_trigger_func`). RLS: sin policies para `anon`/`authenticated`; GRANTs a `service_role` + `postgres` (INSERT/SELECT/UPDATE — el `estado` sí se actualiza acá).
5. **Orden del contrato (decisión 2/5):** FE registra la aceptación ANTES del alta de suscripción. El trigger valida ese orden. Los fixtures que inserten `suscripciones` deben registrar primero la aceptación vigente de `terms`.

## Tareas (en orden de pipeline)

### 1. DBML (`mediacion.dbml`)

- Tablas `legal_documents`, `user_agreements`, `solicitudes_arrepentimiento` completas con FKs y notas.
- Enum `estado_arrepentimiento`.
- Notas: append-only de `user_agreements`, retención 5 años sin CASCADE, vigencia única de `legal_documents`, trigger anti-contratación en `suscripciones`.

### 2. Migración (un único archivo nuevo `supabase/migrations/YYYYMMDDHHmmss_tyc_legal.sql`)

Usá el timestamp real de creación (posterior a `20260814160000_grants_schema_public.sql`). Aditiva, sin `DROP`, sin `ALTER COLUMN TYPE`. Contiene:

- `CREATE TYPE estado_arrepentimiento` (si usás enum, respetá el patrón del repo).
- `CREATE TABLE legal_documents` + partial unique `(tipo) WHERE valid_to IS NULL` + índices.
- `CREATE TABLE user_agreements` + FK RESTRICT + índices `(user_id, document_type, accepted_at DESC)` y `(document_type, document_version)`.
- `CREATE TABLE solicitudes_arrepentimiento` + FK SET NULL + índices (`email`, `received_at`).
- Función `has_accepted_current(user_id UUID, document_type TEXT) RETURNS BOOLEAN` SECURITY DEFINER con `search_path = ''` (regla del linter) y `(SELECT auth.uid())` como InitPlan donde aplique.
- Trigger `BEFORE INSERT` en `suscripciones` que llame a `has_accepted_current` para `usuario_id` (mensaje de error claro, ej. `no_aceptacion_vigente`).
- Trigger anti-UPDATE/DELETE en `user_agreements` (RAISE EXCEPTION incondicional).
- Trigger generador de `codigo` en `solicitudes_arrepentimiento` (secuencia propia).
- Triggers `set_updated_at` y de auditoría donde corresponda (patrón del repo).
- **Policies RLS:** `legal_documents` SELECT anon+authenticated; `user_agreements` SELECT propio para authenticated, **sin** policies de INSERT/UPDATE/DELETE; `solicitudes_arrepentimiento` sin policies (solo grants a roles de servidor).
- **GRANTs explícitos** (filosofía del repo, sin `ALTER DEFAULT PRIVILEGES`): `legal_documents` SELECT a anon/authenticated/service_role/postgres; `user_agreements` INSERT/SELECT a service_role+postgres, SELECT a authenticated (la policy hace el resto); `solicitudes_arrepentimiento` INSERT/SELECT/UPDATE a service_role+postgres.
- **Seeds:** `legal_documents` v1.0 (terms y privacy) con el contenido normalizado de `mediacion-app/mocks/legal-texts.ts`, `valid_from = now()` de la migración, `is_substantial = false`. Usar `ON CONFLICT` para re-ejecución segura.
- RLS habilitado en las 3 tablas (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

> La migración debe aplicar **antes** de los fixtures: el trigger de `suscripciones` necesita los seeds de `legal_documents` y la tabla `user_agreements` ya existentes.

### 3. Testing de migraciones

- `supabase db reset` → **29/29 migraciones aplican sin error**.
- `supabase db lint` → 0 warnings.
- **Actualizar `scripts/smoke_migrations.py`**: +3 tablas en `EXPECTED_TABLES` (24 → 27), +1 enum en `EXPECTED_ENUMS`, +3 en `RLS_TABLES`, +1 check de seeds (`legal_documents` con 2 filas vigentes). Ajustar el total esperado (66/66 → nuevo número) y que pase completo.
- **Actualizar `scripts/validate_rls.py`** con checks nuevos (y ajustar el total 17/17 → nuevo):
  - `anon` puede leer `legal_documents` vigente (página pública sin sesión).
  - `authenticated` (partea) ve solo sus filas de `user_agreements`; non-member ve 0.
  - Intentar `INSERT` en `user_agreements` como `authenticated` falla (permiso denegado).
- **Actualizar fixtures `tmp/`**: todo fixture que inserte `suscripciones` (test_06, test_11, otros que encuentres con grep) debe insertar antes la aceptación vigente de `terms` para el titular (`document_type='terms'`, `document_version` = vigente, `accepted=true`, `ip='127.0.0.1'`, `user_agent='fixture'`). Sin esto, el trigger nuevo rechaza los fixtures y `validate_rls.py` rompe.
- **Probar la garantía (checklist del anexo):**
  1. `UPDATE`/`DELETE` sobre `user_agreements` falla con **al menos dos roles, incluido `service_role`**.
  2. `INSERT` en `suscripciones` (usuario sin aceptación vigente) es **rechazado por la base**, probado por psql directo sin pasar por el front.
  3. `INSERT` en `suscripciones` (usuario con aceptación vigente) pasa.
  4. `marketing` con `accepted=false` se inserta y no bloquea nada.

### 4. Actualizar db-types (hand-maintained)

`packages/db-types/src/database.types.ts`:
- 3 tablas nuevas con sus columnas (`ColumnType<...>` de Kysely).
- Enum `estado_arrepentimiento`.
- `user_agreements.ip` como `string` (INET), timestamps como `Date`.

### 5. Actualizar docs

- `docs/database.md`: árbol de migraciones (28 → 29), conteos (24 → 27 tablas), sección Módulo legal.
- `docs/mediacion_db_develop.md` si corresponde (tablas nuevas, enum, policies, triggers).
- **Changelog obligatorio**: documentar TODO lo hecho en `docs/changelogs-db/` **con fecha 14-08**: agregar una sección "Módulo legal (TyC)" al changelog existente `docs/changelogs-db/2026-08-14.md` (o archivo `2026-08-14-tyc.md` si queda muy largo), indicando: migración creada (nombre/versión), decisiones aplicadas (1-7 del doc de decisiones), resultados de `db reset`/`lint`/`smoke`/`validate_rls`, las 4 pruebas de la garantía, cambios en fixtures y scripts, y los pendientes (datos de Administración para publicar v1.0, criterio de `is_substantial` con Producto+legales, regla para `estudio_id`).

## Reglas estrictas

1. **Solo cambios aditivos.** Nada de DROP/RENAME/ALTER TYPE sobre objetos existentes. Las 47 policies actuales quedan intactas; las tablas nuevas traen las suyas.
2. **Nombres congelados** (§05 del anexo): usá exactamente las columnas de la sección "Contexto y decisiones". Cualquier desvío = PR propio + aviso a FE/BE.
3. **`search_path = ''`** en toda función nueva (linter de Supabase); InitPlan con `(SELECT auth.uid())` donde aplique.
4. **FKs sin CASCADE hacia tablas legales**: `user_agreements.user_id` → `ON DELETE RESTRICT`; `solicitudes_arrepentimiento.usuario_id` → `ON DELETE SET NULL`.
5. **Append-only real**: el trigger anti-UPDATE/DELETE no se saltea por RLS ni por `bypassrls`; probalo con `service_role`.
6. **GRANTs explícitos por objeto en la migración**, siguiendo `20260814160000_grants_schema_public.sql` y el resto del repo. Sin `ALTER DEFAULT PRIVILEGES`.
7. Nombre de archivo de migración con prefijo `YYYYMMDDHHmmss` real y posterior a `20260814160000`.
8. No tocar la rama de FE ni sus mocks; el contenido del seed se copia de `mocks/legal-texts.ts` sin modificar el texto (los `[COMPLETAR]` van tal cual).

## Criterio de aceptación

- `supabase db reset` 29/29 limpio; `supabase db lint` 0 warnings.
- `smoke_migrations.py` pasa con los nuevos conteos (27 tablas, 20 enums, 3 seeds).
- `validate_rls.py` pasa con los checks nuevos (anon lee documentos, user ve sus aceptaciones, INSERT negado).
- Las 4 pruebas de la garantía del anexo pasan y quedan registradas en el changelog.
- `tsc -b` en raíz no da errores en `@mediacion/db-types`.
- Changelog con fecha 14-08 creado/actualizado con todo lo hecho.
