# Prompt — C-01 (Opción A): gate de suscripciones "ambos al día" en `casos`

## Rol

Sos DB Developer en Magne Studios, proyecto "Mediación / Pactum" (plataforma de mediación familiar con IA). Seguís el pipeline: **DBML → migraciones (RLS y triggers en este mismo paso, no después) → scripts Python → QA/E2E → staging → producción en Supabase**. Stack: PostgreSQL 17 local (`supabase/config.toml`, puertos 57001/57002/57003), 37 migraciones secuenciales en `supabase/migrations/` (última: `20260825000000_custom_access_token.sql`), 33 tablas, 21 enums, 15 funciones. Los tipos de BD (`packages/db-types`) se mantienen **a mano**. Los índices se diseñan en la migración, no como afterthought.

## Estado inicial (verificado)

- 37 migraciones, 33 tablas (`EXPECTED_TABLES` en `scripts/smoke_migrations.py`), 21 enums (`EXPECTED_ENUMS`), 15 funciones (`EXPECTED_FUNCTIONS`).
- `estado_caso` = `('nuevo','activo','en_negociacion','acordado','cerrado','terminado','vencido')` + `'expirado'` (agregado en `20260810120000_cambios_reunion_07_08.sql`).
- `estado_suscripcion` = `('activa','cancelada','vencida','pendiente_pago')` + `'pausada'` (`20260821120000_monetizacion_fase1.sql`). "Al día" = `estado = 'activa'`.
- `casos` NO tiene `suscripcion_id`; el vínculo a suscripción es `caso_partes.usuario_id → usuarios.id`, y `usuarios.estudio_id` resuelve la suscripción del estudio (XOR en `suscripciones`: `usuario_id` O `estudio_id`).
- `invitaciones.pago_a_cargo` CHECK `('invitador','invitado')` — **no se toca**.
- Decisiones tomadas y congeladas en `docs/decisiones-db/2026-09-02-c01-c02-cliente.md` (leelas; no re-decidas). La respuesta del cliente está en `docs/respuestas-cliente-01-09-2026.md` (punto 1).

## Objetivo de este ciclo (C-01, Opción A del cliente)

Con Opción A *"cada parte paga su propia suscripción; el caso se habilita cuando los dos están al día"*. El trabajo DB es **solo de lógica baja** (sin nuevas tablas, sin nuevos enums, sin tocar `pago_a_cargo`):

1. **Valor intermedio `estado_caso`: `pendiente_suscripciones`** — el caso queda en este estado mientras espera que la contraparte esté al día.
2. **Función de verificación** que determina si ambas partes de un caso tienen suscripción activa (cubriendo la rama `usuario_id` y la rama `estudio_id`).
3. **Trigger de gate** que impide pasar el caso a `activo` / `en_negociacion` si no se cumple la condición.

> Frontera congelada con BE: el nombre exacto del valor (`pendiente_suscripciones`) y el `SQLSTATE`/mensaje del error se confirman con BE. Usá esos nombres y anotalo en el changelog como "a confirmar con BE". No cambies nombres de `caso_partes`/`suscripciones`/`casos` salvo lo indicado.

## Tareas (en orden de pipeline)

### 1. DBML (`mediacion.dbml`)

- En el enum `estado_caso`, agregá el valor `pendiente_suscripciones` (junto a `expirado`).
- Documentá la función `caso_ambas_partes_suscripciones_activas(p_caso_id uuid)` y el trigger `trg_casos_gate_suscripciones` sobre `casos`, con nota: *"bloquea transición a activo/en_negociacion si alguna parte no tiene suscripción activa (usuario o estudio)"*.

### 2. Migración (un único archivo nuevo `supabase/migrations/YYYYMMDDHHmmss_c01_gate_suscripciones.sql`)

Usá el timestamp real de creación, **posterior a `20260825000000`**. Aditiva, sin `DROP`, sin `ALTER COLUMN TYPE`, sin `ALTER TYPE ... DROP VALUE`. Contiene:

- `ALTER TYPE estado_caso ADD VALUE IF NOT EXISTS 'pendiente_suscripciones';`
  - Nota: `ADD VALUE` no puede correr dentro de una transacción que ya usó el tipo; cada migración corre en su propia txn en `supabase db reset`, así que está bien. El repo ya usa este patrón (`expirado`, `pausada`).
- **Función** `public.caso_ambas_partes_suscripciones_activas(p_caso_id uuid) RETURNS boolean`:
  - `SECURITY DEFINER`, `SET search_path = ''` (regla del linter).
  - Lógica: para cada `usuario_id` en `caso_partes` donde `caso_id = p_caso_id`, verificar que existe al menos una `suscripciones` con `estado = 'activa'` y `(usuario_id = u OR estudio_id = (SELECT estudio_id FROM usuarios WHERE id = u))`. Retorná `true` solo si **todas** las partes cumplen (conjunto vacío → `true`, pero un caso real siempre tiene partes). Espejá la resolución de suscripción efectiva de `consume_quota` (`coalesce(usuarios.estudio_id, ...)`).
  - Usá `PERFORM`/agregación; no devuelvas datos de fila. Cualificá siempre el esquema (`public.`).
- **Trigger** `trg_casos_gate_suscripciones` `BEFORE INSERT OR UPDATE OF estado ON casos FOR EACH ROW EXECUTE FUNCTION`:
  - Si `NEW.estado IN ('activo','en_negociacion')` y es una transición hacia esos estados (en UPDATE: `OLD.estado IS DISTINCT FROM NEW.estado`; en INSERT: el estado se inserta directo), y `NOT caso_ambas_partes_suscripciones_activas(NEW.id)` → `RAISE EXCEPTION 'caso_bloqueado_suscripciones: ambas partes deben tener suscripción activa' USING ERRCODE = 'P0001'`.
  - No bloquees la creación del caso en `nuevo` ni en `pendiente_suscripciones`.
- **RLS / permisos:** el trigger corre con el rol que hace el DML; la función es `SECURITY DEFINER` y lee `suscripciones` (RLS habilitado) como definer, así que **no necesita GRANT EXECUTE** (no es RPC). No agregues policies nuevas a `casos` (ya las tiene). No toques `invitaciones`.
- **Rollback** documentado al final (comentado): `DROP TRIGGER ...`, `DROP FUNCTION ...`, y notar que el `ADD VALUE` no se puede revertir fácilmente (registralo en el changelog como不可逆-en-practica; es aditivo y seguro).

> Precedentes de repo a imitar: `consume_quota` (resolución de suscripción efectiva + `search_path=''`), `has_accepted_current` (función SECURITY DEFINER + gate), `validate_caso_estado_transition` (trigger de transición de estado sobre `casos`).

### 3. Testing de migraciones

- `supabase db reset` → **38/38 migraciones aplican sin error**.
- `supabase db lint` → 0 warnings.
- **Actualizar `scripts/smoke_migrations.py`:** agregar `'caso_ambas_partes_suscripciones_activas'` a `EXPECTED_FUNCTIONS` (15 → 16). `EXPECTED_TABLES` (33) y `EXPECTED_ENUMS` (21) **no cambian** (solo se agrega un valor a un enum existente). Ajustar el total esperado y que pase completo.
- **CRÍTICO — fixtures:** el nuevo trigger rechaza cualquier `casos` que pase a `activo`/`en_negociacion` sin ambas partes con suscripción activa. Grepeá en `tmp/*.sql`, `scripts/seed_data.py` y cualquier script que inserte/actualice `casos` con `estado` en `('activo','en_negociacion')` (y en `caso_partes`/suscripciones asociadas). Para cada fixture que active un caso:
  - asegurá que **ambas partes** tengan una `suscripciones` con `estado='activa'` (creala si falta, respetando el XOR usuario/estudio), o
  - insertá el caso en `nuevo`/`pendiente_suscripciones` y dejá que el test maneje la activación.
  - Sin esto, `validate_rls.py` y los fixtures existentes rompen.
- **Actualizar `scripts/validate_rls.py`** (ajustar el total) con checks nuevos:
  - Caso en `nuevo` con dos partes, **una sin** suscripción activa → `UPDATE casos SET estado='activo'` **falla** (EXCEPTION).
  - Caso con ambas partes con `suscripciones.estado='activa'` → `UPDATE casos SET estado='activo'` **pasa**.
  - Opcional: carrera concurrente de dos activaciones no debe producir un estado inconsistente.
- **Probar la garantía (checklist):**
  1. `UPDATE casos SET estado='activo'` con contraparte sin suscripción activa es **rechazado por la base** (probado por psql directo, no por el front).
  2. `UPDATE casos SET estado='activo'` con ambas partes al día **pasa**.
  3. Insertar caso directo en `activo` sin ambas partes al día también es rechazado.

### 4. Actualizar db-types (hand-maintained)

`packages/db-types/src/database.types.ts`:
- En la unión de `estado_caso`, agregar `'pendiente_suscripciones'`.

### 5. Actualizar docs

- `docs/database.md`: árbol de migraciones (37 → 38), sección de `casos` con el nuevo valor `estado_caso` y el trigger de gate, y la función `caso_ambas_partes_suscripciones_activas`.
- **Changelog obligatorio** `docs/changelogs-db/2026-09-02.md`: migración creada (nombre/versión), decisiones aplicadas (referencia a `docs/decisiones-db/2026-09-02-c01-c02-cliente.md`), resultados de `db reset`/`lint`/`smoke`/`validate_rls`, las 3 pruebas de la garantía, cambios en fixtures y scripts, el valor `pendiente_suscripciones` y el `SQLSTATE`/`mensaje` del gate (marcados "a confirmar con BE"), y el pendiente #6 del cliente (selector FE) que no afecta este ciclo.
- `docs/mediacion_db_develop.md` si corresponde.

## Reglas estrictas

1. **Solo cambios aditivos.** Nada de DROP/RENAME/ALTER TYPE DROP VALUE. Las 33 tablas y 21 enums existentes quedan intactos; las policies de `casos` no se tocan.
2. **`search_path = ''`** en toda función nueva (linter de Supabase); cualificar siempre el esquema (`public.`).
3. **No tocar `pago_a_cargo`** ni `invitaciones` ni FE/BE. La firma del nuevo estado y del error se co-diseña con BE (frontera congelada).
4. **GRANTs:** no se necesitan para la función (solo la invoca el trigger). Si agregás alguno, que sea explícito por objeto, nunca `ALTER DEFAULT PRIVILEGES`.
5. Nombre de archivo de migración con prefijo `YYYYMMDDHHmmss` real y posterior a `20260825000000`.
6. **No hagas `git commit` ni `git push`.** Entregá todo el trabajo (migración + DBML + scripts QA + db-types + docs + changelog) y reportá un resumen; el commit lo hace el DB lead.

## Criterio de aceptación

- `supabase db reset` 38/38 limpio; `supabase db lint` 0 warnings.
- `smoke_migrations.py` pasa (33 tablas, 21 enums, 16 funciones).
- `validate_rls.py` pasa con los checks nuevos del gate (bloqueo y paso).
- Las 3 pruebas de la garantía pasan y quedan registradas en el changelog.
- `tsc -b` en raíz no da errores en `@mediacion/db-types`.
- Changelog `docs/changelogs-db/2026-09-02.md` creado con todo lo hecho.
- Sin commit.
