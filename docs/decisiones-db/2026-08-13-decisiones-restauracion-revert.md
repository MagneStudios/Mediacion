# Decisiones de restauración — Post-revert PR #97 (R-04…R-12)

**Fecha:** 13/08/2026
**Contexto:** El PR #97 ("Revert 'Feat/supabase db'", commit `1c3cbe0`) revirtió todo el trabajo DB de agosto (migración `20260810120000_cambios_reunion_07_08.sql`, las 3 migraciones de linter, el fix de API `plan-limit`, tipos, DBML, scripts y docs). La resolución de conflictos posterior mantuvo el revert en la rama actual, pero los mocks del frontend (R-04…R-10) sí quedaron: el frontend espera un schema que la base ya no tiene. En sesión del 13/08 se decidió cómo reconciliar repo, docs y remoto.
**Principio:** el trabajo DB ya estaba validado (66/66 smoke, 17/17 RLS, 896 tests API, lint 0). Restaurarlo tal cual, sin reescribir lógica.

---

## Decisiones tomadas

### 1. Restaurar el trabajo DB en lugar de rehacerlo

- **Decisión:** re-landear el trabajo revertido restaurando los archivos exactos del estado pre-revert (`1c3cbe0^`).
- **Por qué:** el contenido ya pasó validación completa en su momento; rehacerlo a mano reintroduce riesgo de regresiones sin ganancia. Además el frontend mock R-04…R-10 ya está mergeado y espera ese schema.
- **Consecuencias en repo:**
  - 4 migraciones restauradas: `20260810120000_cambios_reunion_07_08.sql` (R-04 expirado+TTL 72 h, R-05 matrícula, R-07 `pago_a_cargo`, R-09 `facturas`, R-10 plan estudio ilimitado, R-12 `envios_email`) + `20260811130000_linter_security_revoke.sql`, `20260811140000_linter_perf_consolidate_policies.sql`, `20260811150000_linter_perf_fk_indexes.sql`.
  - `packages/db-types/src/database.types.ts` y `mediacion.dbml` restaurados.
  - `apps/api` restaurado al soporte de `limite_casos NULL` = ilimitado (R-10).
  - `smoke_migrations.py` (24 tablas) y `validate_rls.py` (17 checks) restaurados.
  - Docs restaurados: `docs/decisiones-db/2026-08-10-cambios-reunion.md`, `docs/plan-implementacion-07-08-2026.md`, `docs/Cambios_Reunion_Mediacion_07-08-2026.md`, `docs/changelogs/2026-08-11.md`, `docs/changelogs/2026-08-12.md`, `docs/database.md`.

### 2. Método: checkout de rutas, no cherry-pick ni re-merge

- **Decisión:** `git checkout 1c3cbe0^ -- <rutas>` + commits nuevos con Conventional Commits, en el orden DB → tipos → API → scripts → docs. No se cherry-pickean `a59cf2c`/`391eea3`/`2538f42` ni se re-mergea PR #95.
- **Por qué:** el tree actual ya contiene la parte frontend de esos commits y el changelog 08-10 consolidado (DB+FE); cherry-pick o re-merge reintroducirían conflictos e historial duplicado.
- **Consecuencias:** historial nuevo y lineal; los commits originales se referencian por hash en los mensajes para trazabilidad.

### 3. `docs/changelogs/2026-08-10.md` no se restaura

- **Decisión:** conservar la versión actual del tree (sección DB + sección Frontend, consolidada).
- **Por qué:** la versión pre-revert solo tiene la parte DB; restaurarla pisaría la sección Frontend ya mergeada.
- **Consecuencias:** solo se restauran los changelogs que hoy no existen en el tree (08-11 y 08-12).

### 4. Push al VPS como paso aparte, con backup y OK explícito

- **Decisión:** la aplicación del delta al Supabase self-hosted (Coolify) no forma parte de la restauración de archivos. Requiere backup previo de la DB remota y aprobación explícita.
- **Por qué:** el VPS hoy tiene las 22 tablas viejas (las migraciones de agosto no están aplicadas ahí); tocar la instancia compartida sin respaldo es riesgo innecesario.
- **Consecuencias:** hasta el push, existe una deriva controlada y documentada entre repo (27 migraciones) y remoto (23 aplicadas).

### 5. Changelog de DB en carpeta propia

- **Decisión:** la restauración se documenta en `docs/changelogs-db/2026-08-13.md` (carpeta nueva), siguiendo el formato de los changelogs existentes en `docs/changelogs/`.
- **Por qué:** separar el historial de DB del changelog general del proyecto, manteniendo el mismo formato para no fragmentar la convención.
- **Consecuencias:** `docs/changelogs-db/` se crea al cerrar la tarea; el formato (título, sección por fecha, tablas de resultados de tests) replica `docs/changelogs/2026-08-10.md`.

### 6. `docs/mediacion_db_develop.md` sigue siendo local

- **Decisión:** corregir a mano su incoherencia interna (encabezado "52 políticas" vs sección 6.3 "47 políticas" → 47) sin commitearlo.
- **Por qué:** el archivo está gitignored por convención del equipo (doc de trabajo local); no se cambia esa política acá.
- **Consecuencias:** la corrección viaja por fuera de git; se documenta en el prompt de ejecución.

---

## Pendientes no-bloqueantes

- **Push al VPS** — espera OK explícito y backup del remoto (paso 7 del prompt `docs/prompts-db/restaurar-trabajo-db-revertido.md`).
- **Secrets trackeados en git** (`vps_key.pem`, `backup.sql`, `solo_public.sql`): deuda de seguridad detectada en la misma sesión; depuración de historial, tarea aparte que no bloquea esta restauración.
- **Backend de R-09/R-12:** la restauración toca solo schema, tipos y `plan-limit`. La lógica de facturación/emails sigue esperando su ficha de backend (misma situación que antes del revert).
