# Prompt — Extender QA (smoke + validate_rls) para las tablas server-only

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación". Los scripts Python de QA son parte del pipeline: **DBML → migraciones → scripts Python → QA/E2E → staging → producción**. Todo objeto nuevo del schema debe quedar cubierto por `smoke_migrations.py` (existencia/estructura) y, cuando aplica, por `validate_rls.py` (comportamiento de seguridad por rol).

## Estado inicial

- Schema: 30 tablas, 20 enums, 33 migraciones. Locales verdes: `db reset` 33/33, `db lint` 0, `validate_rls.py` 24/24.
- `scripts/smoke_migrations.py`: `EXPECTED_TABLES` y `RLS_TABLES` tienen **27** entradas — faltan `avisos_version_legal`, `solicitudes_contacto`, `rate_limit_counters`. Resultado actual esperado 72/72.
- `scripts/validate_rls.py`: 24 checks, sin cobertura de las 4 tablas server-only.
- Decisión ya tomada: patrón "tabla de rol de servidor" — `docs/decisiones-db/2026-08-18-respuestas-pm-auditoria-db.md` (respuesta 3). No re-decidas.

## Tareas

### 1. `smoke_migrations.py` — 27 → 30 tablas

- Agregar a `EXPECTED_TABLES`: `avisos_version_legal`, `solicitudes_contacto`, `rate_limit_counters`.
- Agregar las mismas 3 a `RLS_TABLES` (las tres tienen RLS habilitada con cero policies).
- Verificar que los 20 `EXPECTED_ENUMS` siguen correctos (no hay enum nuevo: `rate_limit_counters` no usa enum y las otras dos reutilizan `estado_arrepentimiento`).
- Ajustar el total esperado (72/72 → nuevo número) y correr hasta que pase completo.

### 2. `validate_rls.py` — nueva sección "Tablas de rol de servidor (sin policies)"

Checks sobre las 4 tablas (`solicitudes_arrepentimiento`, `avisos_version_legal`, `solicitudes_contacto`, `rate_limit_counters`), probando el patrón de la respuesta 3:

- `anon`: `SELECT` sobre cada tabla devuelve 0 filas (RLS sin policies corta la lectura aunque no haya GRANT).
- `authenticated` (usá `parte_a`): `SELECT` sobre cada tabla devuelve 0 filas.
- `authenticated`: `INSERT` denegado en `solicitudes_contacto` y `avisos_version_legal` (sin GRANT para ese rol) — usá el helper de denied test existente o `run_test` con el assert correcto según el comportamiento real (denegación vs. 0 filas: verificá cuál es y elegí el assert que lo pruebe).
- Bonus si es barato: `INSERT` como `service_role` en `solicitudes_contacto` genera `codigo` `CON-0001…` por trigger (probalo y luego limpiá la fila dentro del mismo test para no ensuciar fixtures).
- Ajustar el total (24 → nuevo número); `scripts/setup_test_env.ps1` debe seguir corriendo `validate_rls.py` completo al final.

### 3. Fixtures `tmp/` (solo si hace falta)

- Los checks de "0 filas" no necesitan datos. Si agregás el bonus de service_role, hacelo con SQL autocontenido en el propio test (insert + cleanup), no con un fixture nuevo.
- Si algo te obliga a fixture nuevo: `tmp/test_18_*.sql` siguiendo el patrón de `test_16` (idempotente, con limpieza). `tmp/` está gitignored.

### 4. Re-verificación completa local (obligatoria, en orden)

1. `"y" | supabase db reset` → **33/33** sin error.
2. `supabase db lint` → **0** warnings.
3. `scripts\setup_test_env.ps1` → fixtures OK + `validate_rls.py` completo verde.
4. `python scripts\smoke_migrations.py` → total nuevo completo.

Si algo falla en el paso 4 pero no en los anteriores, es un check tuyo mal escrito, no un problema de schema — corregilo antes de documentar.

## Documentación del resultado (obligatorio)

Al terminar, documentá en **`docs/changelogs-db/2026-08-18.md`** (archivo ya creado, sección **"QA scripts"**): checks agregados (nombres y qué garantía cubren), totales viejos → nuevos (smoke y validate), resultado de los 4 pasos de re-verificación y cualquier ajuste de fixtures.
