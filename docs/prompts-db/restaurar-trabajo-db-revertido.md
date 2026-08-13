# Prompt — Restaurar el trabajo DB revertido (R-04…R-12 + linter)

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación" (plataforma de mediación y acuerdos extrajudiciales). Seguís el pipeline: **migraciones (RLS/triggers) → testing de migraciones → scripts Python → QA/E2E → staging → producción en Supabase**. Stack: PostgreSQL 17, Supabase local (`supabase/config.toml` puertos 55001/55002/55003) y Supabase self-hosted en el VPS (Coolify). Los tipos de BD (`packages/db-types`) se mantienen **a mano** — cada cambio de schema exige actualizarlos.

## Contexto — Qué pasó

El PR #95 ("Feat/supabase db") trajo el trabajo DB de agosto (migración `20260810120000_cambios_reunion_07_08.sql` + fix de API `plan-limit` + docs). El PR #97 (commit `1c3cbe0`, "Revert 'Feat/supabase db'", mergeado como `225720e`) **revirtió todo ese trabajo**, y la resolución de conflictos posterior (`8ea3d59`) mantuvo el revert en la rama actual.

**Los mocks del frontend (R-04…R-10, commits `1ee44e9`…`5e6c9db`) sí quedaron en la rama.** Resultado: el frontend espera un schema (`pago_a_cargo`, `facturas`, plan estudio ilimitado, estado `expirado`) que la base ya no tiene.

## Estado actual (verificado)

| Artefacto | Docs/changelogs describen | Repo actual tiene |
|---|---|---|
| Migraciones | 27 (4 de agosto) | **23** — faltan `20260810120000_cambios_reunion_07_08.sql`, `20260811130000_linter_security_revoke.sql`, `20260811140000_linter_perf_consolidate_policies.sql`, `20260811150000_linter_perf_fk_indexes.sql` |
| Tablas | 24 (`facturas`, `envios_email`) | **22** |
| `packages/db-types/src/database.types.ts` | +facturas/envios_email, +4 col. usuarios, `pago_a_cargo`, `limite_casos` nullable, `expirado` | Sin esos cambios |
| `mediacion.dbml` | R-04…R-12 aplicados | Sin aplicar |
| `scripts/smoke_migrations.py` | 66/66 (24 tablas) | Espera 22 tablas |
| `scripts/validate_rls.py` | 17 checks | 13 checks |
| `apps/api/src/pagos/plan-limit.service.ts` | `limite_casos NULL` = ilimitado (R-10) | Revertido |
| `docs/database.md` | 27 migraciones | 23 |
| `docs/changelogs/2026-08-11.md`, `2026-08-12.md` | Existen | No existen en el tree |
| VPS (Coolify, schema `public`) | — | 22 tablas viejas: las migraciones de agosto **no están aplicadas en remoto** |

## Fuente de restauración

Todo el trabajo está **intacto en el historial pre-revert** y ya fue validado en su momento (66/66 smoke, 17/17 validate_rls, 896 tests API, `supabase db lint` 0). No hay que reescribir SQL: se restauran los archivos exactos.

Commits de referencia:
- `a59cf2c` — `[FEAT] [DB] cambios reunión 07/08` (migración R-04…R-12 + db-types + dbml + smoke + docs)
- `391eea3` — `[FIX] [DB] correccion de warnings cli rls y performance` (3 migraciones linter + validate_rls + changelogs 08-11/08-12)
- `2538f42` — `fix(api): tratar limite_casos NULL como ilimitado (R-10)`

## Tareas (en orden de pipeline)

### 1. Restaurar migraciones — commit `feat(db): restaura migraciones de agosto revertidas (R-04…R-12 + linter)`

```bash
git checkout 1c3cbe0^ -- \
  supabase/migrations/20260810120000_cambios_reunion_07_08.sql \
  supabase/migrations/20260811130000_linter_security_revoke.sql \
  supabase/migrations/20260811140000_linter_perf_consolidate_policies.sql \
  supabase/migrations/20260811150000_linter_perf_fk_indexes.sql
```

- Verificar que los timestamps son posteriores a la última existente (`20260730180000_backend_gap_features.sql`) y no hay duplicados estilo macOS (`"nombre 2.sql"` — ver nota en `.gitignore`).
- No modificar ninguna migración ya aplicada en algún entorno.

### 2. Restaurar tipos y DBML — commit `feat(db): regenera database.types y mediacion.dbml (R-04…R-12)`

```bash
git checkout 1c3cbe0^ -- packages/db-types/src/database.types.ts mediacion.dbml
```

- Verificar que el typecheck del workspace sigue verde (`pnpm typecheck`).

### 3. Restaurar fix API — commit `fix(api): tratar limite_casos NULL como ilimitado (R-10)`

```bash
git checkout 1c3cbe0^ -- \
  apps/api/src/pagos/plan-limit.service.ts \
  apps/api/src/pagos/plan-limit.service.spec.ts
```

- Correr `pnpm test` en `apps/api` (specs de `pagos/`) y `pnpm typecheck`.

### 4. Restaurar scripts de validación — commit `test(db): smoke 24 tablas + validate_rls 17 checks`

```bash
git checkout 1c3cbe0^ -- \
  scripts/smoke_migrations.py \
  scripts/validate_rls.py \
  scripts/frontend-audit/capture-ai-proposal.mjs \
  scripts/frontend-audit/verify-ai-proposal.mjs
```

### 5. Restaurar docs — commit `docs: restaura docs y changelogs DB de agosto post-revert`

```bash
git checkout 1c3cbe0^ -- \
  docs/decisiones-db/2026-08-10-cambios-reunion.md \
  docs/plan-implementacion-07-08-2026.md \
  docs/Cambios_Reunion_Mediacion_07-08-2026.md \
  docs/changelogs/2026-08-11.md \
  docs/changelogs/2026-08-12.md \
  docs/database.md
```

**No restaurar** `docs/changelogs/2026-08-10.md`: la versión actual del tree ya está consolidada (sección DB + sección Frontend, 194 líneas); la de pre-revert solo tiene la parte DB y la pisaría.

`docs/mediacion_db_develop.md` es un archivo **local** (gitignored, no trackeado): corregir a mano su incoherencia interna — el encabezado dice "52 políticas RLS" pero la sección 6.3 dice 47; el estado correcto post-consolidación es **47 policies en 24 tablas**. No se commitea.

### 6. Validación local (obligatoria antes de declarar la tarea cerrada)

1. `pnpm typecheck` en raíz — db-types y API compilan sin errores.
2. `pnpm test` en `apps/api` — suite verde (plan-limit incluido).
3. `supabase db reset` (o `scripts/apply-migrations.sh` contra una DB limpia) — las **27 migraciones** aplican sin error.
4. `python scripts/smoke_migrations.py` → **66/66 PASS** (24 tablas, incl. `facturas`/`envios_email`, 7 claves de `configuracion`).
5. `scripts/setup_test_env.ps1` + `python scripts/validate_rls.py` → **17/17 PASS**.
6. `supabase db lint` → **0 warnings** (CLI 2.109.1).
7. `git status` — revisar que se restauraron exactamente los archivos esperados y nada más.

### 7. Push al VPS (paso aparte — requiere OK explícito)

El remoto hoy tiene las 22 tablas viejas. Aplicar el delta según `docs/db-push-remoto.md`: CLI de Supabase como contenedor Docker en la red interna del stack Coolify; `supabase db push` aplica solo las 4 migraciones nuevas y las registra en `supabase_migrations.schema_migrations`.

- **Backup de la DB remota antes de pushear.**
- No ejecutar este paso sin aprobación explícita del equipo.

## Reglas estrictas

1. **Restaurar archivos exactos** del pre-revert (contenido ya validado). No reescribir SQL a mano salvo que la validación del paso 6 falle y exija un ajuste puntual — en ese caso documentarlo.
2. **No usar cherry-pick de los merge commits** (reintroduciría historial duplicado y conflictos con el tree actual). Método: `git checkout 1c3cbe0^ -- <rutas>` + commits nuevos con Conventional Commits en español, en el orden DB → tipos → API → scripts → docs.
3. **No restaurar** `docs/changelogs/2026-08-10.md` ni nada del frontend (`mediacion-app/`).
4. Si un `git checkout 1c3cbe0^ -- <ruta>` falla, verificar la ruta exacta con `git ls-tree 1c3cbe0^ --name-only -r`.
5. No tocar RLS existente ni renombrar migraciones ya aplicadas en algún entorno.
6. No commitear secretos: mantener fuera del commit `.env`, `vps_key.pem`, dumps de DB.

## Criterio de aceptación

- 27 migraciones en `supabase/migrations/` (23 + 4 restauradas).
- `smoke_migrations.py` 66/66 · `validate_rls.py` 17/17 · `supabase db lint` 0.
- `pnpm typecheck` y `pnpm test` (API) verdes.
- `docs/database.md` lista 27 migraciones; `docs/mediacion_db_develop.md` coherente (47 policies / 24 tablas); changelogs 08-11 y 08-12 presentes.
- El changelog de esta tarea está creado (ver sección siguiente).

## Changelog obligatorio (no cerrar sin esto)

Al finalizar la implementación y su validación, crear el archivo **`docs/changelogs-db/2026-08-13.md`** (si la carpeta `docs/changelogs-db/` no existe, crearla), respetando el formato de los changelogs anteriores del proyecto (`docs/changelogs/2026-08-10.md`, `2026-08-11.md`): título `# Changelog — Proyecto Mediación`, sección `## 2026-08-13` y subsecciones por bloque (Contexto del revert, Migraciones restauradas con tabla, Linter y RLS, Tests con tabla de resultados, Tipos y documentación, Pendientes — incl. el push al VPS si aún no se ejecutó). Referenciar los commits de restauración y las migraciones por nombre de archivo.
